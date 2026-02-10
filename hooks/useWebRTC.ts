"use client"

import { useRef, useState, useCallback } from "react"

interface UseWebRTCProps {
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onIceCandidate?: (candidate: RTCIceCandidate) => void
  localStream?: MediaStream | null
  currentRoomId?: string | null
}

export function useWebRTC({ 
  onRemoteStream, 
  onConnectionStateChange, 
  onIceCandidate,
  localStream,
  currentRoomId
}: UseWebRTCProps = {}) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isInitiator, setIsInitiator] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  }

  const updateDebugInfo = useCallback(() => {
    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current
      const info = [
        `Connection: ${pc.connectionState}`,
        `ICE: ${pc.iceConnectionState}`,
        `Signaling: ${pc.signalingState}`,
        `Local tracks: ${pc.getSenders().length}`,
        `Remote tracks: ${pc.getReceivers().length}`,
      ].join(" | ")
      setDebugInfo(info)
    }
  }, [])

  const initializePeerConnection = useCallback(() => {
    console.log("🔗 Initializing peer connection...")

    if (peerConnectionRef.current) {
      console.log("🔗 Closing existing peer connection")
      peerConnectionRef.current.close()
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration)
    peerConnectionRef.current = peerConnection

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && currentRoomId) {
        console.log("🧊 Sending ICE candidate:", event.candidate.candidate.slice(0, 50) + "...")
        onIceCandidate?.(event.candidate)
      } else if (!event.candidate) {
        console.log("🧊 ICE gathering complete")
      }
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log("📺 Received remote stream:", event.streams.length, "streams")
      const [remoteStream] = event.streams
      
      if (remoteStream) {
        console.log("📺 Setting remote stream")
        setRemoteStream(remoteStream)
        onRemoteStream?.(remoteStream)
      }
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("🔗 Connection state changed:", peerConnection.connectionState)
      onConnectionStateChange?.(peerConnection.connectionState)
      updateDebugInfo()
    }

    peerConnection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state changed:", peerConnection.iceConnectionState)
      updateDebugInfo()
    }

    peerConnection.onsignalingstatechange = () => {
      console.log("📡 Signaling state changed:", peerConnection.signalingState)
      updateDebugInfo()
    }

    // Add local stream tracks if available
    if (localStream) {
      console.log("🔗 Adding local stream tracks to peer connection")
      localStream.getTracks().forEach((track) => {
        console.log("🔗 Adding track:", track.kind, track.label)
        peerConnection.addTrack(track, localStream)
      })
    }

    updateDebugInfo()
    return peerConnection
  }, [localStream, currentRoomId, onIceCandidate, onRemoteStream, onConnectionStateChange, updateDebugInfo])

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !localStream) {
      console.error("❌ Cannot create offer: missing peer connection or local stream")
      return null
    }

    console.log("📤 Creating offer...")
    setIsInitiator(true)

    try {
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      console.log("📤 Setting local description")
      await peerConnectionRef.current.setLocalDescription(offer)
      return offer
    } catch (error) {
      console.error("❌ Error creating offer:", error)
      return null
    }
  }, [localStream])

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error("❌ Cannot handle offer: no peer connection")
      return null
    }

    console.log("📥 Handling offer...")
    setIsInitiator(false)

    try {
      // Ensure we have local stream before handling offer
      if (!localStream) {
        console.error("❌ No local stream available when handling offer")
        return null
      }

      // Add local tracks if not already added
      const senders = peerConnectionRef.current.getSenders()
      if (senders.length === 0) {
        console.log("📥 Adding local tracks before handling offer")
        localStream.getTracks().forEach((track) => {
          console.log("📥 Adding track:", track.kind, track.label)
          peerConnectionRef.current!.addTrack(track, localStream)
        })
      }

      console.log("📥 Setting remote description")
      await peerConnectionRef.current.setRemoteDescription(offer)

      console.log("📥 Creating answer")
      const answer = await peerConnectionRef.current.createAnswer()

      console.log("📥 Setting local description")
      await peerConnectionRef.current.setLocalDescription(answer)

      return answer
    } catch (error) {
      console.error("❌ Error handling offer:", error)
      return null
    }
  }, [localStream])

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
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
  }, [])

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
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
  }, [])

  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up WebRTC connection")
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    setRemoteStream(null)
    setIsInitiator(false)
    setDebugInfo("")
  }, [])

  return {
    remoteStream,
    isInitiator,
    debugInfo,
    peerConnection: peerConnectionRef.current,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
  }
}
