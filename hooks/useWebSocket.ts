"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { io, type Socket } from "socket.io-client"

interface Message {
  id: string
  text: string
  sender: "user" | "stranger"
  timestamp: Date
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "waiting"

interface UseWebSocketProps {
  onMatched?: (data: { roomId: string; partnerId: string; isInitiator: boolean }) => void
  onWaitingForMatch?: () => void
  onPartnerSkipped?: () => void
  onPartnerDisconnected?: () => void
  onChatMessage?: (data: { message: string; from: string; timestamp: Date }) => void
  onWebRTCOffer?: (data: { offer: RTCSessionDescriptionInit; from: string }) => void
  onWebRTCAnswer?: (data: { answer: RTCSessionDescriptionInit; from: string }) => void
  onWebRTCIceCandidate?: (data: { candidate: RTCIceCandidateInit; from: string }) => void
  onPartnerCameraToggle?: (data: { isOn: boolean; from: string }) => void
  onPartnerMicToggle?: (data: { isOn: boolean; from: string }) => void
}

export function useWebSocket({
  onMatched,
  onWaitingForMatch,
  onPartnerSkipped,
  onPartnerDisconnected,
  onChatMessage,
  onWebRTCOffer,
  onWebRTCAnswer,
  onWebRTCIceCandidate,
  onPartnerCameraToggle,
  onPartnerMicToggle,
}: UseWebSocketProps = {}) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [messages, setMessages] = useState<Message[]>([])
  const [partnerCameraOn, setPartnerCameraOn] = useState(true)
  const [partnerMicOn, setPartnerMicOn] = useState(true)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        console.log("🔌 Initializing WebSocket connection...")
        const { io } = await import("socket.io-client")
        
        // Get access token for authentication
        const { tokenManager } = await import("@/lib/auth")
        const accessToken = tokenManager.getAccessToken()
        
        if (!accessToken) {
          console.error("❌ No access token available for WebSocket connection")
          return
        }
        
        const newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001", {
          transports: ["websocket", "polling"],
          auth: {
            token: accessToken
          }
        })

        socketRef.current = newSocket
        setSocket(newSocket)

        newSocket.on("connect", () => {
          console.log("✅ Connected to WebSocket server")
          console.log("📊 Socket ID:", newSocket.id)
          console.log("📊 Socket connected:", newSocket.connected)
          setIsConnected(true)
        })

        newSocket.on("connect_error", (error) => {
          console.error("❌ WebSocket connection error:", error.message)
          setIsConnected(false)
          
          // If it's an authentication error, we might need to refresh tokens
          if (error.message.includes("Authentication")) {
            console.log("🔄 Authentication failed, may need to refresh token")
          }
        })

        newSocket.on("disconnect", (reason) => {
          console.log("❌ Disconnected from WebSocket server:", reason)
          console.log("📊 Socket ID was:", newSocket.id)
          console.log("📊 Socket connected:", newSocket.connected)
          setIsConnected(false)
          setCurrentRoomId(null)
          setConnectionState("disconnected")
          
          // Handle authentication-related disconnections
          if (reason === "io server disconnect" || reason.includes("Authentication")) {
            console.log("🔄 Disconnected due to authentication issue")
          }
        })

        newSocket.on("matched", (data: any) => {
          console.log("✅ Matched with user:", data)
          setConnectionState("connected")
          setCurrentRoomId(data.roomId)
          setMessages([])
          setPartnerCameraOn(true)
          setPartnerMicOn(true)
          onMatched?.(data)
        })

        newSocket.on("waiting-for-match", () => {
          console.log("⏳ Waiting for match...")
          setConnectionState("waiting")
          onWaitingForMatch?.()
        })

        newSocket.on("partner-skipped", () => {
          console.log("⏭️ Partner skipped")
          setConnectionState("disconnected")
          setCurrentRoomId(null)
          setMessages([])
          onPartnerSkipped?.()
        })

        newSocket.on("partner-disconnected", () => {
          console.log("❌ Partner disconnected")
          setConnectionState("disconnected")
          setCurrentRoomId(null)
          setMessages([])
          onPartnerDisconnected?.()
        })

        newSocket.on("chat-message", (data: any) => {
          console.log("💬 Received message:", data)
          const message: Message = {
            id: Date.now().toString(),
            text: data.message,
            sender: "stranger",
            timestamp: new Date(data.timestamp),
          }
          setMessages((prev) => [...prev, message])
          onChatMessage?.(data)
        })

        newSocket.on("partner-camera-toggle", (data: any) => {
          console.log("📹 Partner camera toggle:", data.isOn)
          setPartnerCameraOn(data.isOn)
          onPartnerCameraToggle?.(data)
        })

        newSocket.on("partner-mic-toggle", (data: any) => {
          console.log("🎤 Partner mic toggle:", data.isOn)
          setPartnerMicOn(data.isOn)
          onPartnerMicToggle?.(data)
        })

        newSocket.on("webrtc-offer", (data: any) => {
          console.log("📥 Received WebRTC offer")
          onWebRTCOffer?.(data)
        })

        newSocket.on("webrtc-answer", (data: any) => {
          console.log("📥 Received WebRTC answer")
          onWebRTCAnswer?.(data)
        })

        newSocket.on("webrtc-ice-candidate", (data: any) => {
          console.log("🧊 Received ICE candidate")
          onWebRTCIceCandidate?.(data)
        })
      } catch (error) {
        console.error("❌ Error initializing WebSocket:", error)
      }
    }

    initializeWebSocket()

    return () => {
      console.log("🧹 Cleaning up WebSocket connection")
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [onMatched, onWaitingForMatch, onPartnerSkipped, onPartnerDisconnected, onChatMessage, onWebRTCOffer, onWebRTCAnswer, onWebRTCIceCandidate, onPartnerCameraToggle, onPartnerMicToggle])

  const findMatch = useCallback(() => {
    if (socket && isConnected) {
      console.log("🔍 Finding match...")
      setConnectionState("connecting")
      socket.emit("find-match")
    }
  }, [socket, isConnected])

  const sendChatMessage = useCallback((message: string) => {
    if (!socket || connectionState !== "connected" || !currentRoomId) return

    console.log("📤 Sending message:", message, "to room:", currentRoomId)

    const newMessage: Message = {
      id: Date.now().toString(),
      text: message,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    socket.emit("chat-message", { roomId: currentRoomId, message })
  }, [socket, connectionState, currentRoomId])

  const skipUser = useCallback(() => {
    if (socket && currentRoomId) {
      console.log("⏭️ Skipping to next user")
      socket.emit("skip-user", { roomId: currentRoomId })
      setConnectionState("disconnected")
      setCurrentRoomId(null)
      setMessages([])
    }
  }, [socket, currentRoomId])

  const sendWebRTCOffer = useCallback((offer: RTCSessionDescriptionInit) => {
    if (socket && currentRoomId) {
      console.log("📤 Sending WebRTC offer via WebSocket")
      socket.emit("webrtc-offer", { roomId: currentRoomId, offer })
    }
  }, [socket, currentRoomId])

  const sendWebRTCAnswer = useCallback((answer: RTCSessionDescriptionInit) => {
    if (socket && currentRoomId) {
      console.log("📤 Sending WebRTC answer via WebSocket")
      socket.emit("webrtc-answer", { roomId: currentRoomId, answer })
    }
  }, [socket, currentRoomId])

  const sendWebRTCIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    if (socket && currentRoomId) {
      socket.emit("webrtc-ice-candidate", { roomId: currentRoomId, candidate })
    }
  }, [socket, currentRoomId])

  const toggleCamera = useCallback((isOn: boolean) => {
    if (socket && currentRoomId) {
      socket.emit("toggle-camera", { roomId: currentRoomId, isOn })
    }
  }, [socket, currentRoomId])

  const toggleMic = useCallback((isOn: boolean) => {
    if (socket && currentRoomId) {
      socket.emit("toggle-mic", { roomId: currentRoomId, isOn })
    }
  }, [socket, currentRoomId])

  return {
    socket,
    isConnected,
    currentRoomId,
    connectionState,
    messages,
    partnerCameraOn,
    partnerMicOn,
    findMatch,
    sendChatMessage,
    skipUser,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendWebRTCIceCandidate,
    toggleCamera,
    toggleMic,
  }
}
