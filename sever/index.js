const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const helmet = require("helmet")
require("dotenv").config()

// Import utilities and middleware
const { testConnection, query } = require("./config/database")
const { authenticateSocket } = require("./middleware/auth")
const { generalLimiter, socketConnectionLimiter } = require("./middleware/rateLimiting")
const { cleanupExpiredTokens } = require("./utils/auth")

// Import routes
const authRoutes = require("./routes/auth")

const app = express()
const server = http.createServer(app)

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}))

// Rate limiting
app.use(generalLimiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// API routes
app.use("/api/auth", authRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  })
})

// Configure Socket.io with authentication
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Socket.io authentication middleware
io.use(authenticateSocket)

// Store connected users and their matching status
const connectedUsers = new Map()
const waitingUsers = new Set()
const activeRooms = new Map()

// Generate unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Find a match for a user
function findMatch(userId) {
  console.log(`🔍 Finding match for user: ${userId}`)

  // Remove user from waiting list if they're there
  waitingUsers.delete(userId)

  // Find another waiting user
  for (const waitingUserId of waitingUsers) {
    if (waitingUserId !== userId) {
      // Create a room for these two users
      const roomId = generateRoomId()
      const user1Socket = connectedUsers.get(userId)
      const user2Socket = connectedUsers.get(waitingUserId)

      if (user1Socket && user2Socket) {
        // Remove both users from waiting
        waitingUsers.delete(waitingUserId)

        // Join both users to the room
        user1Socket.join(roomId)
        user2Socket.join(roomId)

        // Store room info
        activeRooms.set(roomId, {
          users: [userId, waitingUserId],
          createdAt: new Date(),
        })

        // Notify both users they're matched
        user1Socket.emit("matched", { roomId, partnerId: waitingUserId, isInitiator: true })
        user2Socket.emit("matched", { roomId, partnerId: userId, isInitiator: false })

        console.log(`✅ Matched users ${userId} and ${waitingUserId} in room ${roomId}`)
        return true
      }
    }
  }

  // No match found, add to waiting list
  waitingUsers.add(userId)
  console.log(`⏳ Added user ${userId} to waiting list. Total waiting: ${waitingUsers.size}`)
  return false
}

io.on("connection", async (socket) => {
  console.log("👤 Authenticated user connected:", socket.id, "User ID:", socket.user.id)

  // Store user connection with authentication data
  connectedUsers.set(socket.id, socket)
  
  // Track user session in database
  try {
    await query(
      "INSERT INTO user_sessions (user_id, socket_id, connected_at) VALUES ($1, $2, NOW())",
      [socket.user.id, socket.id]
    )
  } catch (error) {
    console.error("Error tracking user session:", error)
  }

  // Handle user joining the matching queue
  socket.on("find-match", async () => {
    console.log("🔍 User looking for match:", socket.user.email, "User ID:", socket.user.id)
    
    // Check if user is already in a room
    const existingSession = await query(
      "SELECT room_id FROM user_sessions WHERE user_id = $1 AND is_active = true AND room_id IS NOT NULL",
      [socket.user.id]
    )
    
    if (existingSession.rows.length > 0) {
      socket.emit("already-in-room", { roomId: existingSession.rows[0].room_id })
      return
    }

    const matched = findMatch(socket.id)
    if (!matched) {
      socket.emit("waiting-for-match")
    }
  })

  // Handle WebRTC signaling
  socket.on("webrtc-offer", (data) => {
    console.log("📡 WebRTC offer from", socket.id, "to room", data.roomId)
    socket.to(data.roomId).emit("webrtc-offer", {
      offer: data.offer,
      from: socket.id,
    })
  })

  socket.on("webrtc-answer", (data) => {
    console.log("📡 WebRTC answer from", socket.id, "to room", data.roomId)
    socket.to(data.roomId).emit("webrtc-answer", {
      answer: data.answer,
      from: socket.id,
    })
  })

  socket.on("webrtc-ice-candidate", (data) => {
    console.log("🧊 ICE candidate from", socket.id, "to room", data.roomId)
    socket.to(data.roomId).emit("webrtc-ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    })
  })

  // Handle chat messages
  socket.on("chat-message", (data) => {
    console.log("💬 Chat message from", socket.id, "to room", data.roomId, ":", data.message)

    // Emit to all other users in the room
    socket.to(data.roomId).emit("chat-message", {
      message: data.message,
      from: socket.id,
      timestamp: new Date(),
    })
  })

  // Handle user skipping to next person
  socket.on("skip-user", (data) => {
    console.log("⏭️ User", socket.id, "skipping in room", data.roomId)

    // Notify the other user that partner skipped
    socket.to(data.roomId).emit("partner-skipped")

    // Leave current room
    socket.leave(data.roomId)

    // Clean up room if needed
    const room = activeRooms.get(data.roomId)
    if (room) {
      const otherUserId = room.users.find((id) => id !== socket.id)
      if (otherUserId) {
        const otherSocket = connectedUsers.get(otherUserId)
        if (otherSocket) {
          otherSocket.leave(data.roomId)
        }
      }
      activeRooms.delete(data.roomId)
    }

    // Find new match
    const matched = findMatch(socket.id)
    if (!matched) {
      socket.emit("waiting-for-match")
    }
  })

  // Handle camera/mic toggle
  socket.on("toggle-camera", (data) => {
    console.log("📹 Camera toggle from", socket.id, "in room", data.roomId, ":", data.isOn)
    socket.to(data.roomId).emit("partner-camera-toggle", {
      isOn: data.isOn,
      from: socket.id,
    })
  })

  socket.on("toggle-mic", (data) => {
    console.log("🎤 Mic toggle from", socket.id, "in room", data.roomId, ":", data.isOn)
    socket.to(data.roomId).emit("partner-mic-toggle", {
      isOn: data.isOn,
      from: socket.id,
    })
  })

  // Handle disconnection
  socket.on("disconnect", async () => {
    console.log("❌ User disconnected:", socket.id, "User ID:", socket.user.id)

    try {
      // Update user session in database
      await query(
        "UPDATE user_sessions SET disconnected_at = NOW(), is_active = false WHERE socket_id = $1",
        [socket.id]
      )

      // Remove from waiting list
      waitingUsers.delete(socket.id)

      // Find and clean up any active rooms
      for (const [roomId, room] of activeRooms.entries()) {
        if (room.users.includes(socket.id)) {
          // Update room and participant status in database
          await query("UPDATE chat_rooms SET closed_at = NOW(), is_active = false WHERE id = $1", [roomId])
          await query(
            "UPDATE room_participants SET left_at = NOW(), is_active = false WHERE room_id = $1 AND user_id = $2",
            [roomId, socket.user.id]
          )

          // Notify other user in room
          const otherUserId = room.users.find((id) => id !== socket.id)
          if (otherUserId) {
            const otherSocket = connectedUsers.get(otherUserId)
            if (otherSocket) {
              otherSocket.emit("partner-disconnected")
              otherSocket.leave(roomId)
            }
          }
          activeRooms.delete(roomId)
          break
        }
      }

      // Remove from connected users
      connectedUsers.delete(socket.id)

      console.log(
        `📊 Stats - Connected: ${connectedUsers.size}, Waiting: ${waitingUsers.size}, Rooms: ${activeRooms.size}`,
      )
    } catch (error) {
      console.error("Error handling disconnect:", error)
    }
  })
})

const PORT = process.env.PORT || 3001

// Startup function with proper error handling
const startServer = async () => {
  try {
    // Test database connection
    await testConnection()
    
    // Clean up expired tokens on startup
    await cleanupExpiredTokens()
    console.log("🧹 Cleaned up expired tokens")

    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 VideoChat server running on port ${PORT}`)
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
      console.log(`📊 Connected users: ${connectedUsers.size}`)
      console.log(`⏳ Waiting users: ${waitingUsers.size}`)
      console.log(`🏠 Active rooms: ${activeRooms.size}`)
    })

  } catch (error) {
    console.error("❌ Server startup failed:", error)
    process.exit(1)
  }
}

// Cleanup tasks that run periodically
setInterval(async () => {
  try {
    // Clean up old rooms
    const now = new Date()
    for (const [roomId, room] of activeRooms.entries()) {
      // Remove rooms older than 1 hour with no activity
      if (now - room.createdAt > 3600000) {
        console.log(`🧹 Cleaning up old room: ${roomId}`)
        activeRooms.delete(roomId)
        
        // Update database
        await query("UPDATE chat_rooms SET closed_at = NOW(), is_active = false WHERE id = $1", [roomId])
      }
    }

    // Clean up expired refresh tokens
    await cleanupExpiredTokens()

    // Clean up old user sessions
    await query(
      "DELETE FROM user_sessions WHERE disconnected_at < NOW() - INTERVAL '24 hours'"
    )

  } catch (error) {
    console.error("❌ Cleanup task error:", error)
  }
}, 300000) // Check every 5 minutes

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...")
  
  // Close all active socket connections
  io.close(() => {
    console.log("✅ Socket.io connections closed")
  })
  
  // Close HTTP server
  server.close(() => {
    console.log("✅ HTTP server closed")
    process.exit(0)
  })
})

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...")
  
  // Close all active socket connections
  io.close(() => {
    console.log("✅ Socket.io connections closed")
  })
  
  // Close HTTP server
  server.close(() => {
    console.log("✅ HTTP server closed")
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

// Start the server
startServer()
