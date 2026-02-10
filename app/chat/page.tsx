"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Settings,
  LogOut,
  AlertCircle,
  RefreshCw,
} from "lucide-react"

// Authentication
import { useAuth } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { tokenManager } from "@/lib/auth"

// Custom hooks
import { useMedia } from "@/hooks/useMedia"
import { useWebRTC } from "@/hooks/useWebRTC"
import { useWebSocket } from "@/hooks/useWebSocket"

// Components
import { VideoContainer } from "@/components/VideoContainer"
import { ChatContainer } from "@/components/ChatContainer"
import { ControlsPanel } from "@/components/ControlsPanel"
import { ConnectionStatus } from "@/components/ConnectionStatus"

function ChatPageContent() {
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  
  const { user, logout } = useAuth()
  const router = useRouter()

  // Custom hooks
  const {
    localStream,
    hasMediaAccess,
    mediaError,
    availableDevices,
    isCheckingDevices,
    checkAvailableDevices,
    requestMediaAccess,
    toggleVideo,
    toggleAudio,
    stopMedia,
  } = useMedia()

  const {
    remoteStream,
    debugInfo,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup: cleanupWebRTC,
  } = useWebRTC({
    localStream,
    currentRoomId: undefined, // Will be set from WebSocket hook
    onIceCandidate: (candidate: RTCIceCandidate) => {
      // This will be set after WebSocket hook provides sendWebRTCIceCandidate
    },
  })

  // Create stable callback references to prevent infinite re-renders
  const onMatched = useCallback(async (data) => {
          console.log("✅ Matched with user:", data)

          // Ensure we have media access before starting WebRTC
    if (!localStream) {
            console.log("🎥 No local stream, requesting media access first...")
            try {
              await requestMediaAccess()
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
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const offer = await createOffer()
      if (offer) {
        // sendWebRTCOffer will be available from WebSocket hook
      }
          } else {
            console.log("📥 This user will wait for offer...")
          }
  }, [localStream, requestMediaAccess, initializePeerConnection, createOffer])

  const onPartnerSkipped = useCallback(() => {
    cleanupWebRTC()
  }, [cleanupWebRTC])

  const onPartnerDisconnected = useCallback(() => {
    cleanupWebRTC()
  }, [cleanupWebRTC])

  const onWebRTCOffer = useCallback(async (data) => {
    console.log("📥 Received WebRTC offer")
    const answer = await handleOffer(data.offer)
    if (answer) {
      // sendWebRTCAnswer will be available from WebSocket hook
    }
  }, [handleOffer])

  const onWebRTCAnswer = useCallback((data) => {
          console.log("📥 Received WebRTC answer")
          handleAnswer(data.answer)
  }, [handleAnswer])

  const onWebRTCIceCandidate = useCallback((data) => {
          console.log("🧊 Received ICE candidate")
          handleIceCandidate(data.candidate)
  }, [handleIceCandidate])

  const {
    isConnected: isWebSocketConnected,
    currentRoomId,
    connectionState,
    messages,
    partnerCameraOn,
    findMatch,
    sendChatMessage,
    skipUser,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendWebRTCIceCandidate,
    toggleCamera,
    toggleMic,
  } = useWebSocket({
    onMatched,
    onPartnerSkipped,
    onPartnerDisconnected,
    onWebRTCOffer,
    onWebRTCAnswer,
    onWebRTCIceCandidate,
  })

  // Initialize device check on component mount
  useEffect(() => {
    console.log("🚀 ChatPage component mounted")
    console.log("✅ User data:", user?.email)

    checkAvailableDevices()

    return () => {
      console.log("🧹 Cleaning up ChatPage component")
      stopMedia()
      cleanupWebRTC()
    }
  }, [user, checkAvailableDevices, stopMedia, cleanupWebRTC])

  // Handle form submission for sending messages
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    sendChatMessage(newMessage.trim())
    setNewMessage("")
  }

  // Handle camera toggle
  const handleCameraToggle = () => {
    const newState = !isCameraOn
    setIsCameraOn(newState)
    toggleVideo(newState)
    toggleCamera(newState)
  }

  // Handle microphone toggle
  const handleMicToggle = () => {
    const newState = !isMicOn
    setIsMicOn(newState)
    toggleAudio(newState)
    toggleMic(newState)
  }

  // Handle logout
  const handleLogout = async () => {
    console.log("👋 Logging out...")
    stopMedia()
    cleanupWebRTC()
    await logout()
    router.push("/")
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
            <Button variant="outline" size="sm" onClick={handleLogout}>
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
                  {debugInfo && <p className="text-xs text-blue-600 mt-1 font-mono">{debugInfo}</p>}
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
          <ConnectionStatus
            connectionState={connectionState}
            isWebSocketConnected={isWebSocketConnected}
            currentRoomId={currentRoomId}
            onFindMatch={() => findMatch()}
            onSkipToNext={skipUser}
          />

          {/* Video Feeds */}
          <VideoContainer
            localStream={localStream}
            remoteStream={remoteStream}
            isCameraOn={isCameraOn}
            partnerCameraOn={partnerCameraOn}
            connectionState={connectionState}
            hasMediaAccess={hasMediaAccess}
            availableDevices={availableDevices}
          />

          {/* Controls */}
          <ControlsPanel
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            hasMediaAccess={hasMediaAccess}
            availableDevices={availableDevices}
            onCameraToggle={handleCameraToggle}
            onMicToggle={handleMicToggle}
          />
                          </div>

        {/* Chat Section */}
        <ChatContainer
          messages={messages}
          newMessage={newMessage}
          connectionState={connectionState}
          onSendMessage={handleSendMessage}
          onMessageChange={setNewMessage}
        />
                          </div>
                        </div>
  )
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  )
}

function ChatPageDebug() {
  const { useAuth } = require("@/contexts/AuthContext")
  const { useRouter } = require("next/navigation")
  const { useEffect, useState, useCallback } = require("react")
  const { useMedia } = require("@/hooks/useMedia")
  const { useWebRTC } = require("@/hooks/useWebRTC")
  const { useWebSocket } = require("@/hooks/useWebSocket")

  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Test the media hook
  const {
    localStream,
    hasMediaAccess,
    mediaError,
    availableDevices,
    isCheckingDevices,
    checkAvailableDevices,
    requestMediaAccess,
    toggleVideo,
    toggleAudio,
    stopMedia,
  } = useMedia()

  // Test the WebRTC hook
  const {
    remoteStream,
    debugInfo,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup: cleanupWebRTC,
  } = useWebRTC({
    localStream,
    currentRoomId: "test-room-123", // Dummy room ID for testing
    onIceCandidate: (candidate) => {
      console.log("🧊 ICE Candidate:", candidate)
    },
  })

  // Create stable callback references to prevent infinite re-renders
  const onMatched = useCallback(async (data) => {
    console.log("✅ Matched with user:", data)
  }, [])

  const onWaitingForMatch = useCallback(() => {
    console.log("⏳ Waiting for match...")
  }, [])

  // Test the WebSocket hook
  const {
    isConnected: isWebSocketConnected,
    currentRoomId,
    connectionState,
    messages,
    partnerCameraOn,
    findMatch,
    sendChatMessage,
    skipUser,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendWebRTCIceCandidate,
    toggleCamera,
    toggleMic,
  } = useWebSocket({
    onMatched,
    onWaitingForMatch,
  })

  useEffect(() => {
    console.log("🔍 Chat page loaded")
    console.log("📊 User:", user)
    console.log("📊 IsAuthenticated:", isAuthenticated)
    console.log("📊 IsLoading:", isLoading)
    
    // Debug token status
    const { tokenManager } = require("@/lib/auth")
    const accessToken = tokenManager.getAccessToken()
    const refreshToken = tokenManager.getRefreshToken()
    
    if (accessToken) {
      console.log("🔑 Access token exists:", accessToken.substring(0, 20) + "...")
      console.log("🔑 Access token expired:", tokenManager.isTokenExpired(accessToken))
    } else {
      console.log("❌ No access token")
    }
    
    if (refreshToken) {
      console.log("🔄 Refresh token exists:", refreshToken.substring(0, 20) + "...")
      console.log("🔄 Refresh token expired:", tokenManager.isTokenExpired(refreshToken))
    } else {
      console.log("❌ No refresh token")
    }
  }, [user, isAuthenticated, isLoading])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log("🔄 Redirecting to login - not authenticated")
      router.push("/")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading...</p>
                          </div>
                      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Redirecting to login...</p>
                      </div>
                    </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Chat Page - Debug Mode</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Info</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Username:</strong> {user?.username || "Not set"}</p>
          <p><strong>ID:</strong> {user?.id}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || "Not set"}</p>
          <p><strong>Server URL:</strong> {process.env.NEXT_PUBLIC_SERVER_URL || "Not set"}</p>
          </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Media Hook Test</h2>
          <p><strong>Has Media Access:</strong> {hasMediaAccess ? "✅ Yes" : "❌ No"}</p>
          <p><strong>Media Error:</strong> {mediaError || "None"}</p>
          <p><strong>Available Cameras:</strong> {availableDevices.cameras}</p>
          <p><strong>Available Mics:</strong> {availableDevices.microphones}</p>
          <p><strong>Checking Devices:</strong> {isCheckingDevices ? "Yes" : "No"}</p>
          <button 
            onClick={requestMediaAccess}
            style={{ marginTop: "10px", padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
          >
            Request Media Access
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">WebRTC Hook Test</h2>
          <p><strong>Remote Stream:</strong> {remoteStream ? "✅ Active" : "❌ None"}</p>
          <p><strong>Debug Info:</strong> {debugInfo || "None"}</p>
          <p><strong>Local Stream:</strong> {localStream ? "✅ Active" : "❌ None"}</p>
          <button 
            onClick={initializePeerConnection}
            style={{ marginTop: "10px", marginRight: "10px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
          >
            Initialize Peer Connection
          </button>
          <button 
            onClick={async () => {
              const offer = await createOffer()
              console.log("📤 Created offer:", offer)
            }}
            style={{ marginTop: "10px", padding: "8px 16px", backgroundColor: "#ffc107", color: "black", border: "none", borderRadius: "4px" }}
          >
            Create Offer
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">WebSocket Hook Test</h2>
          <p><strong>WebSocket Connected:</strong> {isWebSocketConnected ? "✅ Yes" : "❌ No"}</p>
          <p><strong>Connection State:</strong> {connectionState}</p>
          <p><strong>Current Room:</strong> {currentRoomId || "None"}</p>
          <p><strong>Messages:</strong> {messages.length}</p>
          <p><strong>Partner Camera:</strong> {partnerCameraOn ? "✅ On" : "❌ Off"}</p>
          <button 
            onClick={findMatch}
            style={{ marginTop: "10px", marginRight: "10px", padding: "8px 16px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "4px" }}
          >
            Find Match
          </button>
          <button 
            onClick={() => sendChatMessage("Hello from debug!")}
            style={{ marginTop: "10px", padding: "8px 16px", backgroundColor: "#6f42c1", color: "white", border: "none", borderRadius: "4px" }}
          >
            Send Test Message
          </button>
              </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p>✅ Authentication is working!</p>
          <p>✅ Media Hook is working!</p>
          <p>✅ WebRTC Hook is working!</p>
          <p>🧪 Testing WebSocket Hook...</p>
        </div>
      </div>
    </div>
  )
}