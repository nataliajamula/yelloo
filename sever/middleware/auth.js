const { verifyAccessToken } = require("../utils/auth")
const { query } = require("../config/database")

// Authentication middleware for HTTP routes
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" })
    }

    const decoded = verifyAccessToken(token)
    
    // Verify user still exists and is active
    const userResult = await query(
      "SELECT id, email, is_active FROM users WHERE id = $1",
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: "User not found or inactive" })
    }

    req.user = userResult.rows[0]
    next()
  } catch (error) {
    console.error("Authentication error:", error.message)
    return res.status(403).json({ error: "Invalid or expired token" })
  }
}

// Optional authentication (user may or may not be logged in)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      const decoded = verifyAccessToken(token)
      
      const userResult = await query(
        "SELECT id, email, is_active FROM users WHERE id = $1",
        [decoded.userId]
      )

      if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
        req.user = userResult.rows[0]
      }
    }
    
    next()
  } catch (error) {
    // Continue without authentication
    next()
  }
}

// Socket.io authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]

    if (!token) {
      return next(new Error("Authentication error: No token provided"))
    }

    const decoded = verifyAccessToken(token)
    
    // Verify user still exists and is active
    const userResult = await query(
      "SELECT id, email, username, is_active FROM users WHERE id = $1",
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return next(new Error("Authentication error: User not found or inactive"))
    }

    socket.user = userResult.rows[0]
    next()
  } catch (error) {
    console.error("Socket authentication error:", error.message)
    next(new Error("Authentication error: Invalid token"))
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
  authenticateSocket,
}