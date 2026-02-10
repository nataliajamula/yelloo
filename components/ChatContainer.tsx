"use client"

import React, { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send } from "lucide-react"

interface Message {
  id: string
  text: string
  sender: "user" | "stranger"
  timestamp: Date
}

interface ChatContainerProps {
  messages: Message[]
  newMessage: string
  connectionState: "disconnected" | "connecting" | "connected" | "waiting"
  onSendMessage: (e: React.FormEvent) => void
  onMessageChange: (message: string) => void
}

export function ChatContainer({
  messages,
  newMessage,
  connectionState,
  onSendMessage,
  onMessageChange,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
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
            <form onSubmit={onSendMessage} className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => onMessageChange(e.target.value)}
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
  )
}