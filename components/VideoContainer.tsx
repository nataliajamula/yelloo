"use client"

import React, { useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, VideoOff } from "lucide-react"

interface VideoContainerProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isCameraOn: boolean
  partnerCameraOn: boolean
  connectionState: "disconnected" | "connecting" | "connected" | "waiting"
  hasMediaAccess: boolean
  availableDevices: { cameras: number; microphones: number }
}

export function VideoContainer({
  localStream,
  remoteStream,
  isCameraOn,
  partnerCameraOn,
  connectionState,
  hasMediaAccess,
  availableDevices,
}: VideoContainerProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Set up remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch(console.error)
    }
  }, [remoteStream])

  return (
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
  )
}