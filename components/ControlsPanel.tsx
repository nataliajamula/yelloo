"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Video, VideoOff, Mic, MicOff } from "lucide-react"

interface ControlsPanelProps {
  isCameraOn: boolean
  isMicOn: boolean
  hasMediaAccess: boolean
  availableDevices: { cameras: number; microphones: number }
  onCameraToggle: () => void
  onMicToggle: () => void
}

export function ControlsPanel({
  isCameraOn,
  isMicOn,
  hasMediaAccess,
  availableDevices,
  onCameraToggle,
  onMicToggle,
}: ControlsPanelProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-center space-x-4">
          <Button
            variant={isCameraOn ? "default" : "destructive"}
            size="lg"
            onClick={onCameraToggle}
            disabled={!hasMediaAccess || availableDevices.cameras === 0}
          >
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            variant={isMicOn ? "default" : "destructive"}
            size="lg"
            onClick={onMicToggle}
            disabled={!hasMediaAccess || availableDevices.microphones === 0}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}