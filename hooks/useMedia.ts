"use client"

import { useState, useCallback, useRef } from "react"

interface MediaDevices {
  cameras: number
  microphones: number
}

export function useMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [hasMediaAccess, setHasMediaAccess] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [availableDevices, setAvailableDevices] = useState<MediaDevices>({
    cameras: 0,
    microphones: 0,
  })
  const [isCheckingDevices, setIsCheckingDevices] = useState(false)

  const checkAvailableDevices = useCallback(async () => {
    try {
      setIsCheckingDevices(true)
      setMediaError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported in this browser")
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
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
  }, [])

  const requestMediaAccess = useCallback(async () => {
    try {
      setMediaError(null)
      console.log("🎥 Requesting media access...")

      // Stop any existing stream first
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
        setLocalStream(null)
      }

      let stream: MediaStream

      try {
        // Try video + audio first
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

      setLocalStream(stream)
      setHasMediaAccess(true)
      console.log("✅ Media access setup complete")

      return stream
    } catch (error: any) {
      console.error("❌ Error accessing camera/microphone:", error)
      
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
      throw error
    }
  }, [localStream])

  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }, [localStream])

  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }, [localStream])

  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
      setHasMediaAccess(false)
    }
  }, [localStream])

  return {
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
  }
}