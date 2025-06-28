"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Activity, Clock, AlertTriangle, Server, Zap, TrendingUp } from "lucide-react"

interface PerformanceStats {
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  slowestEndpoints: Array<{
    endpoint: string
    averageResponseTime: number
    requestCount: number
    errorRate: number
  }>
  statusCodeDistribution: { [key: string]: number }
}

interface SystemStats {
  averageCpuUsage: number
  averageMemoryUsage: number
  averageDiskUsage: number
  peakConnections: number
  requestsPerMinute: number
}

export function PerformanceDashboard() {
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [timeRange, setTimeRange] = useState("3600000") // 1 hour
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    fetchPerformanceData()
    fetchSystemData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPerformanceData()
      fetchSystemData()
    }, 30000)

    return () => clearInterval(interval)
  }, [timeRange])

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(`/api/monitoring/performance?timeRange=${timeRange}&type=performance`)
      const data = await response.json()

      if (data.success) {
        setPerformanceStats(data.data.stats)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("Failed to fetch performance data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSystemData = async () => {
    try {
      const response = await fetch(`/api/monitoring/performance?timeRange=${timeRange}&type=system`)
      const data = await response.json()

      if (data.success) {
        setSystemStats(data.data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch system data:", error)
    }
  }

  const getTimeRangeLabel = (range: string) => {
    const ranges = {
      "900000": "Last 15 minutes",
      "3600000": "Last hour",
      "21600000": "Last 6 hours",
      "86400000": "Last 24 hours",
      "604800000": "Last 7 days",
    }
    return ranges[range as keyof typeof ranges] || "Custom"
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return "text-green-600"
    if (value <= thresholds.warning) return "text-yellow-600"
    return "text-red-600"
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Performance Dashboard
          </h1>
          <p className="text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="900000">Last 15 minutes</SelectItem>
            <SelectItem value="3600000">Last hour</SelectItem>
            <SelectItem value="21600000">Last 6 hours</SelectItem>
            <SelectItem value="86400000">Last 24 hours</SelectItem>
            <SelectItem value="604800000">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {performanceStats && (
            <>
              {/* Performance KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                        <p className="text-2xl font-bold">{performanceStats.totalRequests.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{getTimeRangeLabel(timeRange)}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                        <p
                          className={`text-2xl font-bold ${getStatusColor(performanceStats.averageResponseTime, { good: 200, warning: 500 })}`}
                        >
                          {performanceStats.averageResponseTime}ms
                        </p>
                        <p className="text-sm text-muted-foreground">Target: {"<200ms"}</p>
                      </div>
                      <Clock className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                        <p
                          className={`text-2xl font-bold ${getStatusColor(performanceStats.errorRate, { good: 1, warning: 5 })}`}
                        >
                          {performanceStats.errorRate}%
                        </p>
                        <p className="text-sm text-muted-foreground">Target: {"<1%"}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold text-green-600">
                          {(100 - performanceStats.errorRate).toFixed(1)}%
                        </p>
                        <p className="text-sm text-muted-foreground">Target: {">99%"}</p>
                      </div>
                      <Zap className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Code Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Code Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(performanceStats.statusCodeDistribution).map(([code, count]) => ({
                          name: code,
                          value: count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.entries(performanceStats.statusCodeDistribution).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {systemStats && (
            <>
              {/* System KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">CPU Usage</p>
                        <span
                          className={`text-sm font-medium ${getStatusColor(systemStats.averageCpuUsage, { good: 50, warning: 80 })}`}
                        >
                          {systemStats.averageCpuUsage}%
                        </span>
                      </div>
                      <Progress value={systemStats.averageCpuUsage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                        <span
                          className={`text-sm font-medium ${getStatusColor(systemStats.averageMemoryUsage, { good: 60, warning: 85 })}`}
                        >
                          {systemStats.averageMemoryUsage}%
                        </span>
                      </div>
                      <Progress value={systemStats.averageMemoryUsage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Disk Usage</p>
                        <span
                          className={`text-sm font-medium ${getStatusColor(systemStats.averageDiskUsage, { good: 70, warning: 90 })}`}
                        >
                          {systemStats.averageDiskUsage}%
                        </span>
                      </div>
                      <Progress value={systemStats.averageDiskUsage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional System Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Peak Connections</p>
                        <p className="text-2xl font-bold">{systemStats.peakConnections}</p>
                      </div>
                      <Server className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Requests/Minute</p>
                        <p className="text-2xl font-bold">{systemStats.requestsPerMinute}</p>
                      </div>
                      <Activity className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {performanceStats && (
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {performanceStats.slowestEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <code className="text-sm font-medium">{endpoint.endpoint}</code>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">{endpoint.requestCount} requests</span>
                          <Badge
                            variant={
                              endpoint.errorRate > 5 ? "destructive" : endpoint.errorRate > 1 ? "secondary" : "default"
                            }
                          >
                            {endpoint.errorRate.toFixed(1)}% errors
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium ${getStatusColor(endpoint.averageResponseTime, { good: 200, warning: 500 })}`}
                        >
                          {endpoint.averageResponseTime}ms
                        </p>
                        <p className="text-xs text-muted-foreground">avg response</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {performanceStats?.statusCodeDistribution["4xx"] || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Client Errors (4xx)</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {performanceStats?.statusCodeDistribution["5xx"] || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Server Errors (5xx)</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {performanceStats ? (100 - performanceStats.errorRate).toFixed(1) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>• Monitor error rates and investigate spikes</p>
                  <p>• Set up alerts for error rates above 5%</p>
                  <p>• Review slow endpoints regularly</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
