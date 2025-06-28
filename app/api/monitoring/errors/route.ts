import { type NextRequest, NextResponse } from "next/server"

interface ErrorLog {
  id: string
  timestamp: number
  level: "error" | "warning" | "info"
  message: string
  stack?: string
  endpoint?: string
  method?: string
  userId?: number
  userAgent?: string
  ip?: string
  metadata?: any
}

class ErrorTracker {
  private static instance: ErrorTracker
  private errors: ErrorLog[] = []
  private readonly maxErrors = 5000

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  logError(error: Omit<ErrorLog, "id" | "timestamp">): string {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...error,
    }

    this.errors.unshift(errorLog)

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error(`[${errorLog.level.toUpperCase()}] ${errorLog.message}`, errorLog.stack)
    }

    // Send critical errors to external service (Sentry, LogRocket, etc.)
    if (errorLog.level === "error" && process.env.NODE_ENV === "production") {
      this.sendToExternalService(errorLog)
    }

    return errorLog.id
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async sendToExternalService(error: ErrorLog): Promise<void> {
    try {
      // Example: Send to Sentry or similar service
      if (process.env.SENTRY_DSN) {
        // Sentry integration would go here
        console.log("Sending error to external service:", error.id)
      }
    } catch (e) {
      console.error("Failed to send error to external service:", e)
    }
  }

  getErrors(
    filters: {
      level?: string
      timeRange?: number
      endpoint?: string
      userId?: number
      limit?: number
    } = {},
  ): ErrorLog[] {
    let filteredErrors = this.errors

    if (filters.timeRange) {
      const cutoff = Date.now() - filters.timeRange
      filteredErrors = filteredErrors.filter((e) => e.timestamp > cutoff)
    }

    if (filters.level) {
      filteredErrors = filteredErrors.filter((e) => e.level === filters.level)
    }

    if (filters.endpoint) {
      filteredErrors = filteredErrors.filter((e) => e.endpoint?.includes(filters.endpoint))
    }

    if (filters.userId) {
      filteredErrors = filteredErrors.filter((e) => e.userId === filters.userId)
    }

    if (filters.limit) {
      filteredErrors = filteredErrors.slice(0, filters.limit)
    }

    return filteredErrors
  }

  getErrorStats(timeRange = 3600000): {
    total: number
    byLevel: { error: number; warning: number; info: number }
    byEndpoint: { [key: string]: number }
    recentErrors: ErrorLog[]
  } {
    const errors = this.getErrors({ timeRange })

    const stats = {
      total: errors.length,
      byLevel: {
        error: errors.filter((e) => e.level === "error").length,
        warning: errors.filter((e) => e.level === "warning").length,
        info: errors.filter((e) => e.level === "info").length,
      },
      byEndpoint: {} as { [key: string]: number },
      recentErrors: errors.slice(0, 10),
    }

    // Group by endpoint
    errors.forEach((error) => {
      if (error.endpoint) {
        stats.byEndpoint[error.endpoint] = (stats.byEndpoint[error.endpoint] || 0) + 1
      }
    })

    return stats
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get("level") || undefined
    const timeRange = Number.parseInt(searchParams.get("timeRange") || "3600000")
    const endpoint = searchParams.get("endpoint") || undefined
    const userId = searchParams.get("userId") ? Number.parseInt(searchParams.get("userId")!) : undefined
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const statsOnly = searchParams.get("statsOnly") === "true"

    const tracker = ErrorTracker.getInstance()

    if (statsOnly) {
      const stats = tracker.getErrorStats(timeRange)
      return NextResponse.json({
        success: true,
        data: stats,
      })
    }

    const errors = tracker.getErrors({
      level,
      timeRange,
      endpoint,
      userId,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: {
        errors,
        total: errors.length,
      },
    })
  } catch (error) {
    console.error("Error tracking API error:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch error data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tracker = ErrorTracker.getInstance()

    const errorId = tracker.logError({
      level: body.level || "error",
      message: body.message,
      stack: body.stack,
      endpoint: body.endpoint,
      method: body.method,
      userId: body.userId,
      userAgent: body.userAgent,
      ip: body.ip,
      metadata: body.metadata,
    })

    return NextResponse.json({
      success: true,
      errorId,
    })
  } catch (error) {
    console.error("Error logging failed:", error)
    return NextResponse.json({ success: false, message: "Failed to log error" }, { status: 500 })
  }
}
