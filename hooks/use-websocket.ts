"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

interface WebSocketMessage {
  type: string
  [key: string]: any
}

interface UseWebSocketOptions {
  url?: string
  reconnectAttempts?: number
  reconnectInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080",
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">(
    "disconnected",
  )
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const ws = useRef<WebSocket | null>(null)
  const reconnectCount = useRef(0)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus("connecting")

    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        setIsConnected(true)
        setConnectionStatus("connected")
        reconnectCount.current = 0

        // Authenticate with stored token
        const token = localStorage.getItem("session_token")
        if (token) {
          sendMessage({
            type: "auth",
            data: { token },
          })
        }

        onConnect?.()
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)

          // Handle system messages
          switch (message.type) {
            case "error":
              toast({
                title: "Connection Error",
                description: message.message,
                variant: "destructive",
              })
              break

            case "auth_success":
              toast({
                title: "Connected",
                description: "Real-time connection established",
              })
              break

            case "notification":
              toast({
                title: message.notification.title,
                description: message.notification.message,
              })
              break
          }

          onMessage?.(message)
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      ws.current.onclose = () => {
        setIsConnected(false)
        setConnectionStatus("disconnected")
        onDisconnect?.()

        // Attempt to reconnect
        if (reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++
          reconnectTimer.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.current.onerror = (error) => {
        setConnectionStatus("error")
        onError?.(error)
        console.error("WebSocket error:", error)
      }
    } catch (error) {
      setConnectionStatus("error")
      console.error("Failed to create WebSocket connection:", error)
    }
  }, [url, reconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError, onMessage, toast])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    if (ws.current) {
      ws.current.close()
      ws.current = null
    }

    setIsConnected(false)
    setConnectionStatus("disconnected")
  }, [])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
      return true
    } else {
      console.warn("WebSocket is not connected")
      return false
    }
  }, [])

  const joinBooking = useCallback(
    (bookingId: number) => {
      return sendMessage({
        type: "join_booking",
        data: { booking_id: bookingId },
      })
    },
    [sendMessage],
  )

  const leaveBooking = useCallback(
    (bookingId: number) => {
      return sendMessage({
        type: "leave_booking",
        data: { booking_id: bookingId },
      })
    },
    [sendMessage],
  )

  const sendChatMessage = useCallback(
    (bookingId: number, content: string, messageType = "text", metadata: any = {}) => {
      return sendMessage({
        type: "send_message",
        data: {
          booking_id: bookingId,
          content,
          message_type: messageType,
          metadata,
        },
      })
    },
    [sendMessage],
  )

  const updateLocation = useCallback(
    (bookingId: number, locationData: any) => {
      return sendMessage({
        type: "location_update",
        data: {
          booking_id: bookingId,
          ...locationData,
        },
      })
    },
    [sendMessage],
  )

  const updateStatus = useCallback(
    (bookingId: number, status: string, message?: string) => {
      return sendMessage({
        type: "status_update",
        data: {
          booking_id: bookingId,
          status,
          message,
        },
      })
    },
    [sendMessage],
  )

  const markMessagesRead = useCallback(
    (messageIds: number[]) => {
      return sendMessage({
        type: "mark_read",
        data: { message_ids: messageIds },
      })
    },
    [sendMessage],
  )

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Ping/pong heartbeat
  useEffect(() => {
    if (!isConnected) return

    const pingInterval = setInterval(() => {
      sendMessage({ type: "ping" })
    }, 30000) // 30 seconds

    return () => clearInterval(pingInterval)
  }, [isConnected, sendMessage])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    joinBooking,
    leaveBooking,
    sendChatMessage,
    updateLocation,
    updateStatus,
    markMessagesRead,
  }
}
