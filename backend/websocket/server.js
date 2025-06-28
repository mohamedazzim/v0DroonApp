/**
 * WebSocket Server - Real-time Features
 * Phase 4: Real-time Features & WebSocket Integration
 */

const WebSocket = require("ws")
const http = require("http")
const mysql = require("mysql2/promise")
const jwt = require("jsonwebtoken")
const Redis = require("redis")

class DroneWebSocketServer {
  constructor() {
    this.server = http.createServer()
    this.wss = new WebSocket.Server({ server: this.server })
    this.clients = new Map() // userId -> WebSocket connection
    this.rooms = new Map() // roomId -> Set of userIds

    this.initializeDatabase()
    this.initializeRedis()
    this.setupWebSocketHandlers()
    this.startHeartbeat()
  }

  async initializeDatabase() {
    this.db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USERNAME || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_DATABASE || "drone_booking",
      charset: "utf8mb4",
    })

    // Create real-time tables
    await this.createRealTimeTables()
  }

  async initializeRedis() {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
    })

    await this.redis.connect()

    // Subscribe to Redis channels for cross-server communication
    this.subscriber = this.redis.duplicate()
    await this.subscriber.connect()

    this.subscriber.subscribe("booking_updates", (message) => {
      this.handleBookingUpdate(JSON.parse(message))
    })

    this.subscriber.subscribe("chat_messages", (message) => {
      this.handleChatMessage(JSON.parse(message))
    })

    this.subscriber.subscribe("location_updates", (message) => {
      this.handleLocationUpdate(JSON.parse(message))
    })
  }

  async createRealTimeTables() {
    // Chat messages table
    await this.db.execute(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                sender_id INT NOT NULL,
                sender_type ENUM('customer', 'operator', 'admin') NOT NULL,
                message_type ENUM('text', 'image', 'file', 'location', 'system') DEFAULT 'text',
                content TEXT NOT NULL,
                metadata JSON,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_booking_id (booking_id),
                INDEX idx_sender_id (sender_id),
                INDEX idx_created_at (created_at)
            )
        `)

    // Live tracking table
    await this.db.execute(`
            CREATE TABLE IF NOT EXISTS live_tracking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                operator_id INT NOT NULL,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                altitude DECIMAL(8, 2),
                speed DECIMAL(6, 2),
                battery_level INT,
                signal_strength INT,
                status ENUM('preparing', 'takeoff', 'flying', 'recording', 'returning', 'landed') DEFAULT 'preparing',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_booking_id (booking_id),
                INDEX idx_timestamp (timestamp)
            )
        `)

    // Notifications table
    await this.db.execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                data JSON,
                is_read BOOLEAN DEFAULT FALSE,
                is_pushed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_type (type),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at)
            )
        `)

    // Online users tracking
    await this.db.execute(`
            CREATE TABLE IF NOT EXISTS online_users (
                user_id INT PRIMARY KEY,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status ENUM('online', 'away', 'busy', 'offline') DEFAULT 'online',
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `)
  }

  setupWebSocketHandlers() {
    this.wss.on("connection", (ws, request) => {
      console.log("New WebSocket connection")

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString())
          await this.handleMessage(ws, message)
        } catch (error) {
          console.error("Message handling error:", error)
          this.sendError(ws, "Invalid message format")
        }
      })

      ws.on("close", () => {
        this.handleDisconnection(ws)
      })

      ws.on("error", (error) => {
        console.error("WebSocket error:", error)
      })

      // Send initial connection message
      this.send(ws, {
        type: "connection",
        status: "connected",
        timestamp: new Date().toISOString(),
      })
    })
  }

  async handleMessage(ws, message) {
    const { type, token, data } = message

    // Authenticate user for most message types
    if (type !== "ping" && type !== "auth") {
      const user = await this.authenticateUser(token)
      if (!user) {
        return this.sendError(ws, "Authentication required")
      }
      ws.userId = user.id
      ws.userRole = user.role
    }

    switch (type) {
      case "auth":
        await this.handleAuth(ws, data)
        break

      case "ping":
        this.send(ws, { type: "pong", timestamp: new Date().toISOString() })
        break

      case "join_booking":
        await this.handleJoinBooking(ws, data)
        break

      case "leave_booking":
        await this.handleLeaveBooking(ws, data)
        break

      case "send_message":
        await this.handleSendMessage(ws, data)
        break

      case "location_update":
        await this.handleLocationUpdate(ws, data)
        break

      case "status_update":
        await this.handleStatusUpdate(ws, data)
        break

      case "mark_read":
        await this.handleMarkRead(ws, data)
        break

      default:
        this.sendError(ws, "Unknown message type")
    }
  }

  async handleAuth(ws, data) {
    try {
      const { token } = data
      const user = await this.authenticateUser(token)

      if (!user) {
        return this.sendError(ws, "Invalid authentication token")
      }

      ws.userId = user.id
      ws.userRole = user.role

      // Store connection
      this.clients.set(user.id, ws)

      // Update online status
      await this.updateOnlineStatus(user.id, "online")

      this.send(ws, {
        type: "auth_success",
        user: {
          id: user.id,
          name: user.full_name,
          role: user.role,
        },
      })

      // Send pending notifications
      await this.sendPendingNotifications(user.id)
    } catch (error) {
      console.error("Auth error:", error)
      this.sendError(ws, "Authentication failed")
    }
  }

  async handleJoinBooking(ws, data) {
    try {
      const { booking_id } = data
      const userId = ws.userId

      // Verify user has access to this booking
      const [rows] = await this.db.execute(
        'SELECT id FROM bookings WHERE id = ? AND (user_id = ? OR ? IN (SELECT id FROM users WHERE role IN ("admin", "operator")))',
        [booking_id, userId, userId],
      )

      if (rows.length === 0) {
        return this.sendError(ws, "Access denied to this booking")
      }

      // Join room
      const roomId = `booking_${booking_id}`
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set())
      }
      this.rooms.get(roomId).add(userId)
      ws.currentRoom = roomId

      this.send(ws, {
        type: "joined_booking",
        booking_id,
        room_id: roomId,
      })

      // Notify others in the room
      this.broadcastToRoom(
        roomId,
        {
          type: "user_joined",
          user_id: userId,
          booking_id,
        },
        userId,
      )

      // Send recent messages
      await this.sendRecentMessages(ws, booking_id)

      // Send current tracking data if available
      await this.sendCurrentTrackingData(ws, booking_id)
    } catch (error) {
      console.error("Join booking error:", error)
      this.sendError(ws, "Failed to join booking")
    }
  }

  async handleLeaveBooking(ws, data) {
    try {
      const { booking_id } = data
      const userId = ws.userId
      const roomId = `booking_${booking_id}`

      if (this.rooms.has(roomId)) {
        this.rooms.get(roomId).delete(userId)

        if (this.rooms.get(roomId).size === 0) {
          this.rooms.delete(roomId)
        }
      }

      ws.currentRoom = null

      this.send(ws, {
        type: "left_booking",
        booking_id,
      })

      // Notify others in the room
      this.broadcastToRoom(
        roomId,
        {
          type: "user_left",
          user_id: userId,
          booking_id,
        },
        userId,
      )
    } catch (error) {
      console.error("Leave booking error:", error)
      this.sendError(ws, "Failed to leave booking")
    }
  }

  async handleSendMessage(ws, data) {
    try {
      const { booking_id, content, message_type = "text", metadata = {} } = data
      const userId = ws.userId
      const userRole = ws.userRole

      // Insert message into database
      const [result] = await this.db.execute(
        "INSERT INTO chat_messages (booking_id, sender_id, sender_type, message_type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)",
        [booking_id, userId, userRole, message_type, content, JSON.stringify(metadata)],
      )

      const messageId = result.insertId

      // Get sender info
      const [senderRows] = await this.db.execute("SELECT full_name, role FROM users WHERE id = ?", [userId])

      const messageData = {
        type: "new_message",
        message: {
          id: messageId,
          booking_id,
          sender_id: userId,
          sender_name: senderRows[0].full_name,
          sender_type: userRole,
          message_type,
          content,
          metadata,
          created_at: new Date().toISOString(),
        },
      }

      // Broadcast to room
      const roomId = `booking_${booking_id}`
      this.broadcastToRoom(roomId, messageData)

      // Publish to Redis for cross-server communication
      await this.redis.publish("chat_messages", JSON.stringify(messageData))

      // Send push notifications to offline users
      await this.sendChatNotifications(booking_id, messageData.message, userId)
    } catch (error) {
      console.error("Send message error:", error)
      this.sendError(ws, "Failed to send message")
    }
  }

  async handleLocationUpdate(ws, data) {
    try {
      const { booking_id, latitude, longitude, altitude, speed, battery_level, signal_strength, status } = data
      const operatorId = ws.userId

      // Verify operator has access to this booking
      const [rows] = await this.db.execute(
        'SELECT id FROM bookings WHERE id = ? AND ? IN (SELECT id FROM users WHERE role IN ("admin", "operator"))',
        [booking_id, operatorId],
      )

      if (rows.length === 0) {
        return this.sendError(ws, "Access denied to update location for this booking")
      }

      // Insert tracking data
      await this.db.execute(
        "INSERT INTO live_tracking (booking_id, operator_id, latitude, longitude, altitude, speed, battery_level, signal_strength, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [booking_id, operatorId, latitude, longitude, altitude, speed, battery_level, signal_strength, status],
      )

      const trackingData = {
        type: "location_update",
        booking_id,
        operator_id: operatorId,
        latitude,
        longitude,
        altitude,
        speed,
        battery_level,
        signal_strength,
        status,
        timestamp: new Date().toISOString(),
      }

      // Broadcast to room
      const roomId = `booking_${booking_id}`
      this.broadcastToRoom(roomId, trackingData)

      // Publish to Redis
      await this.redis.publish("location_updates", JSON.stringify(trackingData))
    } catch (error) {
      console.error("Location update error:", error)
      this.sendError(ws, "Failed to update location")
    }
  }

  async handleStatusUpdate(ws, data) {
    try {
      const { booking_id, status, message } = data
      const userId = ws.userId

      // Update booking status
      await this.db.execute("UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?", [status, booking_id])

      const statusData = {
        type: "status_update",
        booking_id,
        status,
        message,
        updated_by: userId,
        timestamp: new Date().toISOString(),
      }

      // Broadcast to room
      const roomId = `booking_${booking_id}`
      this.broadcastToRoom(roomId, statusData)

      // Send notifications
      await this.sendStatusNotifications(booking_id, statusData)
    } catch (error) {
      console.error("Status update error:", error)
      this.sendError(ws, "Failed to update status")
    }
  }

  async handleMarkRead(ws, data) {
    try {
      const { message_ids } = data
      const userId = ws.userId

      if (message_ids && message_ids.length > 0) {
        const placeholders = message_ids.map(() => "?").join(",")
        await this.db.execute(
          `UPDATE chat_messages SET is_read = TRUE WHERE id IN (${placeholders}) AND sender_id != ?`,
          [...message_ids, userId],
        )
      }

      this.send(ws, {
        type: "messages_marked_read",
        message_ids,
      })
    } catch (error) {
      console.error("Mark read error:", error)
      this.sendError(ws, "Failed to mark messages as read")
    }
  }

  async authenticateUser(token) {
    try {
      if (!token) return null

      // Verify session token with database
      const [rows] = await this.db.execute(
        'SELECT u.id, u.full_name, u.role FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = ? AND s.status = "active" AND s.expires_at > NOW()',
        [token],
      )

      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      console.error("Authentication error:", error)
      return null
    }
  }

  async updateOnlineStatus(userId, status) {
    try {
      await this.db.execute(
        "INSERT INTO online_users (user_id, status) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = ?, last_seen = NOW()",
        [userId, status, status],
      )
    } catch (error) {
      console.error("Update online status error:", error)
    }
  }

  async sendPendingNotifications(userId) {
    try {
      const [notifications] = await this.db.execute(
        "SELECT * FROM notifications WHERE user_id = ? AND is_pushed = FALSE ORDER BY created_at DESC LIMIT 50",
        [userId],
      )

      if (notifications.length > 0) {
        const ws = this.clients.get(userId)
        if (ws) {
          this.send(ws, {
            type: "pending_notifications",
            notifications,
          })

          // Mark as pushed
          const notificationIds = notifications.map((n) => n.id)
          const placeholders = notificationIds.map(() => "?").join(",")
          await this.db.execute(
            `UPDATE notifications SET is_pushed = TRUE WHERE id IN (${placeholders})`,
            notificationIds,
          )
        }
      }
    } catch (error) {
      console.error("Send pending notifications error:", error)
    }
  }

  async sendRecentMessages(ws, bookingId) {
    try {
      const [messages] = await this.db.execute(
        "SELECT cm.*, u.full_name as sender_name FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.booking_id = ? ORDER BY cm.created_at DESC LIMIT 50",
        [bookingId],
      )

      this.send(ws, {
        type: "recent_messages",
        booking_id: bookingId,
        messages: messages.reverse(),
      })
    } catch (error) {
      console.error("Send recent messages error:", error)
    }
  }

  async sendCurrentTrackingData(ws, bookingId) {
    try {
      const [tracking] = await this.db.execute(
        "SELECT * FROM live_tracking WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 1",
        [bookingId],
      )

      if (tracking.length > 0) {
        this.send(ws, {
          type: "current_tracking",
          booking_id: bookingId,
          tracking: tracking[0],
        })
      }
    } catch (error) {
      console.error("Send current tracking data error:", error)
    }
  }

  broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.forEach((userId) => {
        if (userId !== excludeUserId) {
          const ws = this.clients.get(userId)
          if (ws && ws.readyState === WebSocket.OPEN) {
            this.send(ws, message)
          }
        }
      })
    }
  }

  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  sendError(ws, message) {
    this.send(ws, {
      type: "error",
      message,
      timestamp: new Date().toISOString(),
    })
  }

  handleDisconnection(ws) {
    if (ws.userId) {
      this.clients.delete(ws.userId)

      // Remove from rooms
      if (ws.currentRoom) {
        const room = this.rooms.get(ws.currentRoom)
        if (room) {
          room.delete(ws.userId)
          if (room.size === 0) {
            this.rooms.delete(ws.currentRoom)
          }
        }
      }

      // Update online status
      this.updateOnlineStatus(ws.userId, "offline")
    }
  }

  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate()
        }

        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // 30 seconds

    this.wss.on("connection", (ws) => {
      ws.isAlive = true
      ws.on("pong", () => {
        ws.isAlive = true
      })
    })
  }

  async sendChatNotifications(bookingId, message, senderId) {
    try {
      // Get booking participants
      const [participants] = await this.db.execute(
        'SELECT DISTINCT user_id FROM bookings WHERE id = ? UNION SELECT DISTINCT id FROM users WHERE role IN ("admin", "operator")',
        [bookingId],
      )

      for (const participant of participants) {
        if (participant.user_id !== senderId) {
          // Check if user is online
          const isOnline = this.clients.has(participant.user_id)

          if (!isOnline) {
            // Create notification for offline users
            await this.db.execute(
              "INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)",
              [
                participant.user_id,
                "new_message",
                "New Message",
                `${message.sender_name}: ${message.content}`,
                JSON.stringify({ booking_id: bookingId, message_id: message.id }),
              ],
            )
          }
        }
      }
    } catch (error) {
      console.error("Send chat notifications error:", error)
    }
  }

  async sendStatusNotifications(bookingId, statusData) {
    try {
      // Get booking owner
      const [booking] = await this.db.execute("SELECT user_id FROM bookings WHERE id = ?", [bookingId])

      if (booking.length > 0) {
        const userId = booking[0].user_id

        // Create notification
        await this.db.execute(
          "INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)",
          [
            userId,
            "status_update",
            "Booking Status Updated",
            `Your booking status has been updated to: ${statusData.status}`,
            JSON.stringify({ booking_id: bookingId, status: statusData.status }),
          ],
        )

        // Send real-time notification if user is online
        const ws = this.clients.get(userId)
        if (ws) {
          this.send(ws, {
            type: "notification",
            notification: {
              type: "status_update",
              title: "Booking Status Updated",
              message: `Your booking status has been updated to: ${statusData.status}`,
              data: { booking_id: bookingId, status: statusData.status },
            },
          })
        }
      }
    } catch (error) {
      console.error("Send status notifications error:", error)
    }
  }

  start(port = 8080) {
    this.server.listen(port, () => {
      console.log(`WebSocket server started on port ${port}`)
    })
  }
}

// Start the server
const wsServer = new DroneWebSocketServer()
wsServer.start(process.env.WS_PORT || 8080)

module.exports = DroneWebSocketServer
