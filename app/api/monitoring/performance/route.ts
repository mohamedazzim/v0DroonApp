import { type NextRequest, NextResponse } from "next/server"

interface PerformanceMetric {
  timestamp: number
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  userAgent?: string
  ip?: string
  userId?: number
}

interface SystemMetrics {
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeConnections: number
  requestsPerMinute: number
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private systemMetrics: SystemMetrics[] = []
  private readonly maxMetrics = 10000 // Keep last 10k metrics

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  recordSystemMetric(metric: SystemMetrics) {
    this.systemMetrics.push(metric)

    // Keep only last 24 hours of system metrics (assuming 1 per minute)
    if (this.systemMetrics.length > 1440) {
      this.systemMetrics = this.systemMetrics.slice(-1440)
    }
  }

  getMetrics(timeRange = 3600000): PerformanceMetric[] {
    const cutoff = Date.now() - timeRange
    return this.metrics.filter((m) => m.timestamp > cutoff)
  }

  getSystemMetrics(timeRange = 3600000): SystemMetrics[] {
    const cutoff = Date.now() - timeRange
    return this.systemMetrics.filter((m) => m.timestamp > cutoff)
  }

  getPerformanceStats(timeRange = 3600000) {
    const metrics = this.getMetrics(timeRange)

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowestEndpoints: [],
        statusCodeDistribution: {},
      }
    }

    const totalRequests = metrics.length
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
    const errorCount = metrics.filter((m) => m.statusCode >= 400).length
    const errorRate = (errorCount / totalRequests) * 100

    // Group by endpoint for slowest endpoints
    const endpointStats: { [key: string]: { count: number; totalTime: number; errors: number } } = {}

    metrics.forEach((metric) => {
      const key = `${metric.method} ${metric.endpoint}`
      if (!endpointStats[key]) {
        endpointStats[key] = { count: 0, totalTime: 0, errors: 0 }
      }
      endpointStats[key].count++
      endpointStats[key].totalTime += metric.responseTime
      if (metric.statusCode >= 400) {
        endpointStats[key].errors++
      }
    })

    const slowestEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        averageResponseTime: stats.totalTime / stats.count,
        requestCount: stats.count,
        errorRate: (stats.errors / stats.count) * 100,
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10)

    // Status code distribution
    const statusCodeDistribution: { [key: string]: number } = {}
    metrics.forEach((metric) => {
      const statusRange = `${Math.floor(metric.statusCode / 100)}xx`
      statusCodeDistribution[statusRange] = (statusCodeDistribution[statusRange] || 0) + 1
    })

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowestEndpoints,
      statusCodeDistribution,
    }
  }

  getSystemStats(timeRange = 3600000) {
    const metrics = this.getSystemMetrics(timeRange)

    if (metrics.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        averageDiskUsage: 0,
        peakConnections: 0,
        requestsPerMinute: 0,
      }
    }

    return {
      averageCpuUsage: Math.round((metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length) * 100) / 100,
      averageMemoryUsage: Math.round((metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length) * 100) / 100,
      averageDiskUsage: Math.round((metrics.reduce((sum, m) => sum + m.diskUsage, 0) / metrics.length) * 100) / 100,
      peakConnections: Math.max(...metrics.map((m) => m.activeConnections)),
      requestsPerMinute: Math.round(metrics.reduce((sum, m) => sum + m.requestsPerMinute, 0) / metrics.length),
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = Number.parseInt(searchParams.get("timeRange") || "3600000") // Default 1 hour
    const type = searchParams.get("type") || "performance"

    const monitor = PerformanceMonitor.getInstance()

    if (type === "system") {
      const systemStats = monitor.getSystemStats(timeRange)
      const systemMetrics = monitor.getSystemMetrics(timeRange)

      return NextResponse.json({
        success: true,
        data: {
          stats: systemStats,
          metrics: systemMetrics,
        },
      })
    } else {
      const performanceStats = monitor.getPerformanceStats(timeRange)
      const metrics = monitor.getMetrics(timeRange)

      return NextResponse.json({
        success: true,
        data: {
          stats: performanceStats,
          metrics: metrics,
        },
      })
    }
  } catch (error) {
    console.error("Performance monitoring error:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch performance data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const monitor = PerformanceMonitor.getInstance()

    if (body.type === "system") {
      monitor.recordSystemMetric({
        timestamp: Date.now(),
        cpuUsage: body.cpuUsage || 0,
        memoryUsage: body.memoryUsage || 0,
        diskUsage: body.diskUsage || 0,
        activeConnections: body.activeConnections || 0,
        requestsPerMinute: body.requestsPerMinute || 0,
      })
    } else {
      monitor.recordMetric({
        timestamp: Date.now(),
        endpoint: body.endpoint,
        method: body.method,
        responseTime: body.responseTime,
        statusCode: body.statusCode,
        userAgent: body.userAgent,
        ip: body.ip,
        userId: body.userId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Performance recording error:", error)
    return NextResponse.json({ success: false, message: "Failed to record performance data" }, { status: 500 })
  }
}
