"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Send, ImageIcon, MapPin } from "lucide-react"
import { useWebSocket } from "@/hooks/use-websocket"
import { formatDistanceToNow } from "date-fns"

interface ChatMessage {
  id: number
  booking_id: number
  sender_id: number
  sender_name: string
  sender_type: "customer" | "operator" | "admin"
  message_type: "text" | "image" | "file" | "location" | "system"
  content: string
  metadata?: any
  is_read: boolean
  created_at: string
}

interface BookingChatProps {
  bookingId: number
  currentUserId: number
  currentUserRole: string
}

export function BookingChat({ bookingId, currentUserId, currentUserRole }: BookingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { isConnected, lastMessage, sendChatMessage, joinBooking, leaveBooking, markMessagesRead } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      joinBooking(bookingId)
    },
  })

  function handleWebSocketMessage(message: any) {
    switch (message.type) {
      case "recent_messages":
        if (message.booking_id === bookingId) {
          setMessages(message.messages)
        }
        break

      case "new_message":
        if (message.message.booking_id === bookingId) {
          setMessages((prev) => [...prev, message.message])

          // Mark as read if not from current user
          if (message.message.sender_id !== currentUserId) {
            setTimeout(() => {
              markMessagesRead([message.message.id])
            }, 1000)
          }
        }
        break

      case "user_joined":
        if (message.booking_id === bookingId) {
          setOnlineUsers((prev) => new Set([...prev, message.user_id]))
        }
        break

      case "user_left":
        if (message.booking_id === bookingId) {
          setOnlineUsers((prev) => {
            const newSet = new Set(prev)
            newSet.delete(message.user_id)
            return newSet
          })
        }
        break

      case "messages_marked_read":
        setMessages((prev) =>
          prev.map((msg) => (message.message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg)),
        )
        break
    }
  }

  const handleSendMessage = () => {
    if (!newMessage.trim() || !isConnected) return

    const success = sendChatMessage(bookingId, newMessage.trim())
    if (success) {
      setNewMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    return () => {
      leaveBooking(bookingId)
    }
  }, [bookingId, leaveBooking])

  const renderMessage = (message: ChatMessage) => {
    const isOwnMessage = message.sender_id === currentUserId
    const isSystem = message.message_type === "system"

    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center my-2">
          <Badge variant="secondary" className="text-xs">
            {message.content}
          </Badge>
        </div>
      )
    }

    return (
      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-4`}>
        <div className={`flex max-w-[70%] ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
          <Avatar className="w-8 h-8 mx-2">
            <AvatarFallback>
              {message.sender_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className={`rounded-lg p-3 ${isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{message.sender_name}</span>
              <Badge variant="outline" className="text-xs">
                {message.sender_type}
              </Badge>
            </div>

            <div className="text-sm">
              {message.message_type === "text" && message.content}
              {message.message_type === "image" && (
                <div>
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Image shared
                </div>
              )}
              {message.message_type === "location" && (
                <div>
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location shared
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs opacity-70">
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </span>
              {isOwnMessage && <div className="text-xs opacity-70">{message.is_read ? "✓✓" : "✓"}</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Chat</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-sm text-muted-foreground">{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2">
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim() || !isConnected} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
