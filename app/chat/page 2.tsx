"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Send,
  Settings,
  SkipForward,
  LogOut,
  AlertCircle,
  RefreshCw,
  Bug,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Message {
  id: string
  text: string
  sender: "user" | "stranger"
  timestamp: Date
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "waiting"

export default function ChatPage() {
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [user, setUser] = useState<any>(null)
  const [partnerCameraOn, setPartnerCameraOn] = useState(true)
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [hasMediaAccess, setHasMediaAccess] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [videoDebugInfo, setVideoDebugInfo] = useState<string>("")
  const [webrtcDebugInfo, setWebrtcDebugInfo] = useState<string>("")
  const [availableDevices, setAvailableDevices] = useState<{ cameras: number; microphones: number }>({
    cameras: 0,
    microphones: 0,
  })
  const [isCheckingDevices, setIsCheckingDevices] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const socketRef = useRef<any>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const isInitiatorRef = useRef<boolean>(false)

  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  }

  const checkAvailableDevices = async () => {
    try {
      setIsCheckingDevices(true)
      console.log("Checking available devices...")

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported in this browser")
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      console.log("Available devices:", devices)

      const cameras = devices.filter((device) => device.kind === "videoinput").length
      const microphones = devices.filter((device) => device.kind === "audioinput").length

      setAvailableDevices({ cameras, microphones })
      console.log(`Found ${cameras} cameras and ${microphones} microphones`)
    } catch (error: any) {
      console.error("Error checking devices:", error)
      setMediaError(`Device detection failed: ${error.message}`)
    } finally {
      setIsCheckingDevices(false)
    }
  }

  const updateVideoDebugInfo = () => {
    if (localStreamRef.current && localVideoRef.current) {
      const stream = localStreamRef.current
      const video = localVideoRef.current
      const videoTracks = stream.getVideoTracks()

      const info = [
        `Stream: ${stream.id.slice(0, 8)}`,
        `Video tracks: ${videoTracks.length}`,
        `Video ready state: ${video.readyState}`,
        `Video paused: ${video.paused}`,
        `Video muted: ${video.muted}`,
        `Video dimensions: ${video.videoWidth}x${video.videoHeight}`,
        `Track enabled: ${videoTracks[0]?.enabled}`,
        `Track ready state: ${videoTracks[0]?.readyState}`,
      ].join(" | ")

      setVideoDebugInfo(info)
    }
  }

  const updateWebRTCDebugInfo = () => {
    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current
      const info = [
        `Connection: ${pc.connectionState}`,
        `ICE: ${pc.iceConnectionState}`,
        `Signaling: ${pc.signalingState}`,
        `Local tracks: ${pc.getSenders().length}`,
        `Remote tracks: ${pc.getReceivers().length}`,
      ].join(" | ")
      setWebrtcDebugInfo(info)
    }
  }

  const initializePeerConnection = () => {
    console.log("🔗 Initializing peer connection...")

    if (peerConnectionRef.current) {
      console.log("🔗 Closing existing peer connection")
      peerConnectionRef.current.close()
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration)
    peerConnectionRef.current = peerConnection

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && currentRoomId) {
        console.log("🧊 Sending ICE candidate:", event.candidate.candidate.slice(0, 50) + "...")
        socketRef.current.emit("webrtc-ice-candidate", {
          roomId: currentRoomId,
          candidate: event.candidate,
        })
      } else if (!event.candidate) {
        console.log("🧊 ICE gathering complete")
      }
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log("📺 Received remote stream:", event.streams.length, "streams")
      console.log("📺 Track details:", event.track.kind, event.track.label, event.track.readyState)

      const [remoteStream] = event.streams

      if (remoteVideoRef.current && remoteStream) {
        console.log("📺 Setting remote stream to video element")
        console.log("📺 Remote stream details:", {
          id: remoteStream.id,
          active: remoteStream.active,
          tracks: remoteStream.getTracks().map((t) => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
          })),
        })

        // Force set the stream immediately
        remoteVideoRef.current.srcObject = remoteStream

        // Set up event listeners for the remote video
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("📺 Remote video metadata loaded:", {
            width: remoteVideoRef.current?.videoWidth,
            height: remoteVideoRef.current?.videoHeight,
            readyState: remoteVideoRef.current?.readyState,
          })
        }

        remoteVideoRef.current.oncanplay = () => {
          console.log("📺 Remote video can play")
        }

        remoteVideoRef.current.onerror = (e) => {
          console.error("❌ Remote video error:", e)
        }

        // Force play the remote video
        remoteVideoRef.current
          .play()
          .then(() => console.log("✅ Remote video playing"))
          .catch((e) => {
            console.error("❌ Error playing remote video:", e)
          })
      } else {
        console.error("❌ No remote video ref or stream available")
      }
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("🔗 Connection state changed:", peerConnection.connectionState)
      updateWebRTCDebugInfo()
    }

    peerConnection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state changed:", peerConnection.iceConnectionState)
      updateWebRTCDebugInfo()
    }

    peerConnection.onsignalingstatechange = () => {
      console.log("📡 Signaling state changed:", peerConnection.signalingState)
      updateWebRTCDebugInfo()
    }

    // Add local stream tracks if available
    if (localStreamRef.current) {
      console.log("🔗 Adding local stream tracks to peer connection")
      localStreamRef.current.getTracks().forEach((track) => {
        console.log("🔗 Adding track:", track.kind, track.label)
        peerConnection.addTrack(track, localStreamRef.current!)
      })
    }

    updateWebRTCDebugInfo()
    return peerConnection
  }

  const createOffer = async () => {
    if (!peerConnectionRef.current || !localStreamRef.current) {
      console.error("❌ Cannot create offer: missing peer connection or local stream")
      return
    }

    console.log("📤 Creating offer...")
    isInitiatorRef.current = true

    try {
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      console.log("📤 Setting local description")
      await peerConnectionRef.current.setLocalDescription(offer)

      if (socketRef.current && currentRoomId) {
        console.log("📤 Sending offer via WebSocket")
        socketRef.current.emit("webrtc-offer", {
          roomId: currentRoomId,
          offer: offer,
        })
      }
    } catch (error) {
      console.error("❌ Error creating offer:", error)
    }
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error("❌ Cannot handle offer: no peer connection")
      return
    }

    console.log("📥 Handling offer...")
    isInitiatorRef.current = false

    try {
      // Ensure we have local stream before handling offer
      if (!localStreamRef.current) {
        console.error("❌ No local stream available when handling offer")
        return
      }

      // Add local tracks if not already added
      const senders = peerConnectionRef.current.getSenders()
      if (senders.length === 0) {
        console.log("📥 Adding local tracks before handling offer")
        localStreamRef.current.getTracks().forEach((track) => {
          console.log("📥 Adding track:", track.kind, track.label)
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
        })
      }

      console.log("📥 Setting remote description")
      await peerConnectionRef.current.setRemoteDescription(offer)

      console.log("📥 Creating answer")
      const answer = await peerConnectionRef.current.createAnswer()

      console.log("📥 Setting local description")
      await peerConnectionRef.current.setLocalDescription(answer)

      if (socketRef.current && currentRoomId) {
        console.log("📥 Sending answer via WebSocket")
        socketRef.current.emit("webrtc-answer", {
          roomId: currentRoomId,
          answer: answer,
        })
      }
    } catch (error) {
      console.error("❌ Error handling offer:", error)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error("❌ Cannot handle answer: no peer connection")
      return
    }

    console.log("📥 Handling answer...")

    try {
      console.log("📥 Setting remote description from answer")
      await peerConnectionRef.current.setRemoteDescription(answer)
      console.log("✅ Answer handled successfully")
    } catch (error) {
      console.error("❌ Error handling answer:", error)
    }
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.error("❌ Cannot handle ICE candidate: no peer connection")
      return
    }

    console.log("🧊 Adding ICE candidate:", candidate.candidate?.slice(0, 50) + "...")

    try {
      await peerConnectionRef.current.addIceCandidate(candidate)
      console.log("✅ ICE candidate added successfully")
    } catch (error) {
      console.error("❌ Error adding ICE candidate:", error)
    }
  }

  const requestMediaAccess = async () => {
    try {
      setMediaError(null)
      setVideoDebugInfo("Requesting access...")
      console.log("🎥 Requesting media access...")

      // Stop any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }

      let stream: MediaStream

      try {
        console.log("🎥 Trying video + audio...")
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        console.log("✅ Got both video and audio")
      } catch (error: any) {
        console.log("❌ Video + audio failed, trying video only...")
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: "user",
          },
          audio: false,
        })
        console.log("✅ Got video only")
        setMediaError("Camera access granted. Microphone access denied.")
      }

      // Store the stream
      localStreamRef.current = stream
      setHasMediaAccess(true)

      console.log("🎥 Stream details:", {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        tracks: stream.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
        })),
      })

      // Wait a moment for stream to be ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Set up the video element with proper sequencing
      if (localVideoRef.current) {
        console.log("🎥 Setting up video element...")
        const video = localVideoRef.current

        // Reset video element completely
        video.pause()
        video.removeAttribute("src")
        video.load()

        // Set up event listeners before setting srcObject
        const setupPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video setup timeout"))
          }, 10000)

          video.onloadedmetadata = () => {
            console.log("📹 Video metadata loaded:", {
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
              readyState: video.readyState,
            })
            clearTimeout(timeout)
            resolve()
          }

          video.onerror = (e) => {
            console.error("❌ Video error:", e, video.error)
            clearTimeout(timeout)
            reject(new Error(`Video error: ${video.error?.message || "Unknown error"}`))
          }
        })

        // Set video properties
        video.autoplay = true
        video.muted = true
        video.playsInline = true
        video.controls = false

        // Set the stream
        console.log("🎥 Assigning stream to video element...")
        video.srcObject = stream

        try {
          // Wait for metadata to load
          await setupPromise
          console.log("🎥 Video metadata loaded successfully")

          // Now try to play
          console.log("🎥 Attempting to play video...")
          await video.play()
          console.log("✅ Video playing successfully")

          // Update debug info
          updateVideoDebugInfo()
        } catch (error) {
          console.error("❌ Error in video setup:", error)

          // Try alternative approach - create new video element
          console.log("🔄 Trying alternative video setup...")
          const newVideo = document.createElement("video")
          newVideo.autoplay = true
          newVideo.muted = true
          newVideo.playsInline = true
          newVideo.style.width = "100%"
          newVideo.style.height = "100%"
          newVideo.style.objectFit = "cover"
          newVideo.style.transform = "scaleX(-1)"

          newVideo.srcObject = stream

          // Replace the video element
          if (video.parentNode) {
            video.parentNode.replaceChild(newVideo, video)
            localVideoRef.current = newVideo
          }

          await newVideo.play()
          console.log("✅ Alternative video setup successful")
        }
      }

      // Update debug info periodically
      const debugInterval = setInterval(updateVideoDebugInfo, 2000)
      setTimeout(() => clearInterval(debugInterval), 30000)

      console.log("✅ Media access setup complete")
    } catch (error: any) {
      console.error("❌ Error accessing camera/microphone:", error)
      setVideoDebugInfo(`Error: ${error.message}`)

      let errorMessage = "Unable to access camera and microphone. "
      switch (error.name) {
        case "NotAllowedError":
          errorMessage += "Please allow camera and microphone permissions when prompted by your browser."
          break
        case "NotFoundError":
          errorMessage += "No camera or microphone found. Please check your device connections."
          break
        case "NotReadableError":
          errorMessage += "Camera is being used by another application. Please close other video apps."
          break
        default:
          errorMessage += `Error: ${error.message}`
      }
      setMediaError(errorMessage)
    }
  }

  // Initialize user and WebSocket on component mount
  useEffect(() => {
    console.log("🚀 ChatPage component mounted")

    const userData = localStorage.getItem("user")
    if (!userData) {
      console.log("❌ No user data found, redirecting to login")
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(userData)
    console.log("✅ User data loaded:", parsedUser.email)
    setUser(parsedUser)

    checkAvailableDevices()

    const initializeWebSocket = async () => {
      try {
        console.log("🔌 Initializing WebSocket connection...")
        const { io } = await import("socket.io-client")
        const socket = io("http://localhost:3001", {
          transports: ["websocket", "polling"],
        })

        socketRef.current = socket

        socket.on("connect", () => {
          console.log("✅ Connected to WebSocket server")
          setIsWebSocketConnected(true)
        })

        socket.on("disconnect", () => {
          console.log("❌ Disconnected from WebSocket server")
          setIsWebSocketConnected(false)
          setCurrentRoomId(null)
        })

        socket.on("matched", async (data: any) => {
          console.log("✅ Matched with user:", data)
          setConnectionState("connected")
          setCurrentRoomId(data.roomId)
          setMessages([])

          // Ensure we have media access before starting WebRTC
          if (!localStreamRef.current) {
            console.log("🎥 No local stream, requesting media access first...")
            try {
              await requestMediaAccess()
              // Wait a bit for stream to be ready
              await new Promise((resolve) => setTimeout(resolve, 1000))
            } catch (error) {
              console.error("❌ Failed to get media access:", error)
              return
            }
          }

          // Wait a bit to ensure both users are ready
          await new Promise((resolve) => setTimeout(resolve, 1500))

          // Initialize WebRTC connection
          console.log("🔗 Starting WebRTC setup...")
          initializePeerConnection()

          // Wait for peer connection to be ready
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // If this is the initiator, create an offer
          if (data.isInitiator) {
            console.log("📤 This user is the initiator, creating offer...")
            await new Promise((resolve) => setTimeout(resolve, 1500)) // Extra delay for initiator
            createOffer()
          } else {
            console.log("📥 This user will wait for offer...")
          }
        })

        socket.on("waiting-for-match", () => {
          console.log("⏳ Waiting for match...")
          setConnectionState("waiting")
        })

        socket.on("partner-skipped", () => {
          console.log("⏭️ Partner skipped")
          setConnectionState("disconnected")
          setCurrentRoomId(null)
          setMessages([])
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
          }
        })

        socket.on("partner-disconnected", () => {
          console.log("❌ Partner disconnected")
          setConnectionState("disconnected")
          setCurrentRoomId(null)
          setMessages([])
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
          }
        })

        socket.on("chat-message", (data: any) => {
          console.log("💬 Received message:", data)
          const message: Message = {
            id: Date.now().toString(),
            text: data.message,
            sender: "stranger",
            timestamp: new Date(data.timestamp),
          }
          setMessages((prev) => [...prev, message])
        })

        socket.on("partner-camera-toggle", (data: any) => {
          console.log("📹 Partner camera toggle:", data.isOn)
          setPartnerCameraOn(data.isOn)
        })

        socket.on("webrtc-offer", (data: any) => {
          console.log("📥 Received WebRTC offer")
          handleOffer(data.offer)
        })

        socket.on("webrtc-answer", (data: any) => {
          console.log("📥 Received WebRTC answer")
          handleAnswer(data.answer)
        })

        socket.on("webrtc-ice-candidate", (data: any) => {
          console.log("🧊 Received ICE candidate")
          handleIceCandidate(data.candidate)
        })
      } catch (error) {
        console.error("❌ Error initializing WebSocket:", error)
      }
    }

    initializeWebSocket()

    return () => {
      console.log("🧹 Cleaning up ChatPage component")
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [router])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleFindMatch = () => {
    if (user && socketRef.current && isWebSocketConnected) {
      console.log("🔍 Finding match for user:", user.email)
      setConnectionState("connecting")
      socketRef.current.emit("find-match", user)
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !socketRef.current || connectionState !== "connected" || !currentRoomId) return

    console.log("📤 Sending message:", newMessage, "to room:", currentRoomId)

    const message: Message = {
      id: Date.now().toString(),
      text: newMessage,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, message])
    socketRef.current.emit("chat-message", { roomId: currentRoomId, message: newMessage })
    setNewMessage("")
  }

  const handleSkipToNext = () => {
    if (socketRef.current && currentRoomId) {
      console.log("⏭️ Skipping to next user")
      socketRef.current.emit("skip-user", { roomId: currentRoomId })
    }
    setConnectionState("disconnected")
    setCurrentRoomId(null)
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
  }

  const handleCameraToggle = () => {
    const newState = !isCameraOn
    console.log("📹 Toggling camera:", newState)
    setIsCameraOn(newState)

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = newState
      })
    }

    if (socketRef.current && currentRoomId) {
      socketRef.current.emit("toggle-camera", { roomId: currentRoomId, isOn: newState })
    }
  }

  const handleMicToggle = () => {
    const newState = !isMicOn
    console.log("🎤 Toggling microphone:", newState)
    setIsMicOn(newState)

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = newState
      })
    }

    if (socketRef.current && currentRoomId) {
      socketRef.current.emit("toggle-mic", { roomId: currentRoomId, isOn: newState })
    }
  }

  const debugWebRTC = () => {
    console.log("🧪 WebRTC Debug Information:")

    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current
      console.log("Peer Connection State:", pc.connectionState)
      console.log("ICE Connection State:", pc.iceConnectionState)
      console.log("Signaling State:", pc.signalingState)

      console.log(
        "Local Senders:",
        pc.getSenders().map((sender) => ({
          track: sender.track
            ? {
                kind: sender.track.kind,
                label: sender.track.label,
                enabled: sender.track.enabled,
                readyState: sender.track.readyState,
              }
            : null,
        })),
      )

      console.log(
        "Remote Receivers:",
        pc.getReceivers().map((receiver) => ({
          track: receiver.track
            ? {
                kind: receiver.track.kind,
                label: receiver.track.label,
                enabled: receiver.track.enabled,
                readyState: receiver.track.readyState,
              }
            : null,
        })),
      )
    } else {
      console.log("No peer connection available")
    }

    if (localStreamRef.current) {
      console.log("Local Stream:", {
        id: localStreamRef.current.id,
        active: localStreamRef.current.active,
        tracks: localStreamRef.current.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      })
    }

    if (remoteVideoRef.current?.srcObject) {
      const remoteStream = remoteVideoRef.current.srcObject as MediaStream
      console.log("Remote Stream:", {
        id: remoteStream.id,
        active: remoteStream.active,
        tracks: remoteStream.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      })
    } else {
      console.log("No remote stream available")
    }

    updateWebRTCDebugInfo()

    // Check remote video element specifically
    if (remoteVideoRef.current) {
      console.log("Remote Video Element:", {
        srcObject: remoteVideoRef.current.srcObject,
        readyState: remoteVideoRef.current.readyState,
        videoWidth: remoteVideoRef.current.videoWidth,
        videoHeight: remoteVideoRef.current.videoHeight,
        paused: remoteVideoRef.current.paused,
        currentTime: remoteVideoRef.current.currentTime,
      })
    } else {
      console.log("No remote video element reference")
    }
  }

  const testVideoElement = () => {
    console.log("🧪 Testing video element...")
    if (localVideoRef.current && localStreamRef.current) {
      const video = localVideoRef.current
      const stream = localStreamRef.current

      console.log("Video element:", {
        srcObject: video.srcObject,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        autoplay: video.autoplay,
        playsInline: video.playsInline,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        currentTime: video.currentTime,
        duration: video.duration,
      })

      console.log("Stream:", {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().map((t) => ({
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
          label: t.label,
          settings: t.getSettings(),
        })),
      })

      // Force reload the video
      console.log("🔄 Force reloading video...")
      video.load()

      // Try to play again
      video
        .play()
        .then(() => console.log("✅ Video play successful"))
        .catch((e) => {
          console.error("❌ Video play failed:", e)

          // Try creating a completely new video element
          console.log("🆕 Creating new video element...")
          const newVideo = document.createElement("video")
          newVideo.autoplay = true
          newVideo.muted = true
          newVideo.playsInline = true
          newVideo.className = video.className
          newVideo.style.cssText = video.style.cssText
          newVideo.srcObject = stream

          if (video.parentNode) {
            video.parentNode.replaceChild(newVideo, video)
            localVideoRef.current = newVideo
            newVideo.play()
          }
        })
    }
  }

  const logout = () => {
    console.log("👋 Logging out...")
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    localStorage.removeItem("user")
    router.push("/")
  }

  // Show loading state while user is being loaded
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-primary">VideoChat</h1>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span>{isWebSocketConnected ? "Connected" : "Disconnected"}</span>
            </div>
            {currentRoomId && <div className="text-xs text-gray-500">Room: {currentRoomId.slice(0, 8)}...</div>}
            <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-4 gap-4">
        {/* Video Section */}
        <div className="flex-1 space-y-4">
          {/* Device Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p>
                    <strong>Devices:</strong> {availableDevices.cameras} camera(s), {availableDevices.microphones}{" "}
                    mic(s)
                  </p>
                  <p>
                    <strong>Media access:</strong> {hasMediaAccess ? "✅ Granted" : "❌ Not granted"}
                  </p>
                  {videoDebugInfo && <p className="text-xs text-gray-600 mt-1 font-mono">{videoDebugInfo}</p>}
                  {webrtcDebugInfo && <p className="text-xs text-blue-600 mt-1 font-mono">{webrtcDebugInfo}</p>}
                </div>
                <div className="flex space-x-2">
                  <Button onClick={checkAvailableDevices} size="sm" variant="outline" disabled={isCheckingDevices}>
                    {isCheckingDevices ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                  {hasMediaAccess && (
                    <Button onClick={testVideoElement} size="sm" variant="outline">
                      Test Video
                    </Button>
                  )}
                  {connectionState === "connected" && (
                    <Button onClick={debugWebRTC} size="sm" variant="outline">
                      <Bug className="h-4 w-4 mr-1" />
                      Debug WebRTC
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Media Access Alert */}
          {!hasMediaAccess && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Camera and microphone access required for video chat</span>
                <Button onClick={requestMediaAccess} size="sm">
                  Enable Camera & Mic
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Media Error Alert */}
          {mediaError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="whitespace-pre-line">{mediaError}</div>
                <div className="mt-2 space-x-2">
                  <Button onClick={requestMediaAccess} size="sm" variant="outline">
                    Try Again
                  </Button>
                  <Button onClick={checkAvailableDevices} size="sm" variant="outline">
                    Check Devices
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      connectionState === "connected"
                        ? "bg-green-500"
                        : connectionState === "connecting" || connectionState === "waiting"
                          ? "bg-yellow-500"
                          : "bg-gray-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {connectionState === "connected" && "Connected to stranger"}
                    {connectionState === "waiting" && "Waiting for someone..."}
                    {connectionState === "connecting" && "Connecting..."}
                    {connectionState === "disconnected" && "Not connected"}
                  </span>
                </div>
                <div className="flex space-x-2">
                  {connectionState === "disconnected" && (
                    <Button onClick={handleFindMatch} disabled={!isWebSocketConnected}>
                      Find Someone
                    </Button>
                  )}
                  {connectionState === "connected" && (
                    <Button variant="outline" size="sm" onClick={handleSkipToNext}>
                      <SkipForward className="h-4 w-4 mr-2" />
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Feeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User's Video */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">You</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden">
                  {hasMediaAccess ? (
                    <>
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
                        style={{
                          transform: "scaleX(-1)",
                          backgroundColor: "#000",
                        }}
                      />
                      {!isCameraOn && (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <div className="text-gray-400 text-center">
                            <VideoOff className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Camera Off</p>
                          </div>
                        </div>
                      )}
                      {/* Debug overlay */}
                      <div className="absolute top-2 left-2 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded">
                        {localStreamRef.current?.getVideoTracks().length || 0} video tracks
                        {localVideoRef.current && (
                          <div>
                            {localVideoRef.current.videoWidth}x{localVideoRef.current.videoHeight}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <div className="text-gray-400 text-center">
                        <Video className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">Enable camera access</p>
                        <p className="text-xs mt-1">
                          {availableDevices.cameras === 0
                            ? "No camera detected"
                            : `${availableDevices.cameras} camera(s) found`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stranger's Video */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stranger</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden">
                  {connectionState === "connected" ? (
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${!partnerCameraOn ? "hidden" : ""}`}
                      />
                      {!partnerCameraOn && (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <div className="text-gray-400 text-center">
                            <VideoOff className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Partner's Camera Off</p>
                          </div>
                        </div>
                      )}
                      {/* Debug overlay for remote video */}
                      <div className="absolute top-2 right-2 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded">
                        {remoteVideoRef.current?.srcObject
                          ? `Stream: ${(remoteVideoRef.current.srcObject as MediaStream).id.slice(0, 8)}`
                          : "No stream"}
                        {remoteVideoRef.current && (
                          <div>
                            {remoteVideoRef.current.videoWidth}x{remoteVideoRef.current.videoHeight}
                            <div>Ready: {remoteVideoRef.current.readyState}</div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <div className="text-gray-400 text-center">
                        {connectionState === "waiting" || connectionState === "connecting" ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                        ) : (
                          <VideoOff className="h-12 w-12 mx-auto mb-2" />
                        )}
                        <p className="text-sm">
                          {connectionState === "waiting"
                            ? "Waiting..."
                            : connectionState === "connecting"
                              ? "Connecting..."
                              : "No Connection"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-center space-x-4">
                <Button
                  variant={isCameraOn ? "default" : "destructive"}
                  size="lg"
                  onClick={handleCameraToggle}
                  disabled={!hasMediaAccess || availableDevices.cameras === 0}
                >
                  {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={isMicOn ? "default" : "destructive"}
                  size="lg"
                  onClick={handleMicToggle}
                  disabled={!hasMediaAccess || availableDevices.microphones === 0}
                >
                  {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Section */}
        <div className="w-full lg:w-80">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-96">
                <div className="space-y-3">
                  {messages.length === 0 && connectionState === "connected" && (
                    <div className="text-center text-gray-500 text-sm">Connected! Start chatting...</div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      connectionState === "connected" ? "Type a message..." : "Connect to someone to chat..."
                    }
                    disabled={connectionState !== "connected"}
                  />
                  <Button type="submit" size="sm" disabled={connectionState !== "connected"}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
