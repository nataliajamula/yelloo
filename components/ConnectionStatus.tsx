"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SkipForward } from "lucide-react"

interface ConnectionStatusProps {
  connectionState: "disconnected" | "connecting" | "connected" | "waiting"
  isWebSocketConnected: boolean
  currentRoomId: string | null
  onFindMatch: () => void
  onSkipToNext: () => void
}

export function ConnectionStatus({
  connectionState,
  isWebSocketConnected,
  currentRoomId,
  onFindMatch,
  onSkipToNext,
}: ConnectionStatusProps) {
  return (
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
              <Button onClick={onFindMatch} disabled={!isWebSocketConnected}>
                Find Someone
              </Button>
            )}
            {connectionState === "connected" && (
              <Button variant="outline" size="sm" onClick={onSkipToNext}>
                <SkipForward className="h-4 w-4 mr-2" />
                Next
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}