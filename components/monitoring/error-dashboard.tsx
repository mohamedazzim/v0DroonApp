"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { AlertTriangle, Bug, Info, Search, RefreshCw } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

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

interface ErrorStats {
  total: number
  byLevel: {
    error: number
    warning: number
    info: number
  }
  byEndpoint: { [key: string]: number }
  recentErrors: ErrorLog[]
}

export function ErrorDashboard() {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null)
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [timeRange, setTimeRange] = useState("3600000")
  const [levelFilter, setLevelFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchErrorData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchErrorData, 30000)
    return () => clearInterval(interval)
  }, [timeRange, levelFilter])

  const fetchErrorData = async () => {
    try {
      setIsLoading(true)

      // Fetch stats
      const statsResponse = await fetch(`/api/monitoring/errors?timeRange=${timeRange}&statsOnly=true`)
      const statsData = await statsResponse.json()

      if (statsData.success) {
        setErrorStats(statsData.data)
      }

      // Fetch errors
      const level = levelFilter === "all" ? "" : levelFilter
      const errorsResponse = await fetch(`/api/monitoring/errors?timeRange=${timeRange}&level=${level}&limit=100`)
      const errorsData = await errorsResponse.json()

      if (errorsData.success) {
        setErrors(errorsData.data.errors)
      }
    } catch (error) {
      console.error("Failed to fetch error data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <Bug className="w-4 h-4" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-800"
      case "warning":
        return "bg-yellow-100 text-yellow-800"
      case "info":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredErrors = errors.filter(
    (error) =>
      error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.endpoint?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const COLORS = ["#ef4444", "#f59e0b", "#3b82f6"]

  if (isLoading && !errorStats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
            <Bug className="w-8 h-8" />
            Error Tracking
          </h1>
          <p className="text-muted-foreground">Monitor and analyze application errors</p>
        </div>

        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="900000">Last 15 min</SelectItem>
              <SelectItem value="3600000">Last hour</SelectItem>
              <SelectItem value="21600000">Last 6 hours</SelectItem>
              <SelectItem value="86400000">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchErrorData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {errorStats && (
        <>
          {/* Error Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Errors</p>
                    <p className="text-2xl font-bold">{errorStats.total}</p>
                  </div>
                  <Bug className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critical Errors</p>
                    <p className="text-2xl font-bold text-red-600">{errorStats.byLevel.error}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Warnings</p>
                    <p className="text-2xl font-bold text-yellow-600">{errorStats.byLevel.warning}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="errors">Error List</TabsTrigger>
              <TabsTrigger value="endpoints">By Endpoint</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Error Level Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Error Level Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Errors", value: errorStats.byLevel.error },
                            { name: "Warnings", value: errorStats.byLevel.warning },
                            { name: "Info", value: errorStats.byLevel.info },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Recent Errors */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-80">
                      <div className="space-y-2">
                        {errorStats.recentErrors.map((error) => (
                          <div
                            key={error.id}
                            className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedError(error)}
                          >
                            <div className="flex items-start gap-2">
                              {getLevelIcon(error.level)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{error.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className={getLevelColor(error.level)}>
                                    {error.level}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search errors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="error">Errors</SelectItem>
                        <SelectItem value="warning">Warnings</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Error List */}
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-96">
                    <div className="space-y-1">
                      {filteredErrors.map((error) => (
                        <div
                          key={error.id}
                          className="p-4 border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedError(error)}
                        >
                          <div className="flex items-start gap-3">
                            {getLevelIcon(error.level)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={getLevelColor(error.level)}>
                                  {error.level}
                                </Badge>
                                {error.endpoint && (
                                  <code className="text-xs bg-muted px-1 rounded">{error.endpoint}</code>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm font-medium">{error.message}</p>
                              {error.stack && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {error.stack.split("\n")[0]}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="endpoints" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Endpoint</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={Object.entries(errorStats.byEndpoint).map(([endpoint, count]) => ({
                        endpoint: endpoint.length > 30 ? endpoint.substring(0, 30) + "..." : endpoint,
                        count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getLevelIcon(selectedError.level)}
                  <CardTitle>Error Details</CardTitle>
                  <Badge className={getLevelColor(selectedError.level)}>{selectedError.level}</Badge>
                </div>
                <Button variant="ghost" onClick={() => setSelectedError(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Message</h3>
                <p className="text-sm bg-muted p-3 rounded">{selectedError.message}</p>
              </div>

              {selectedError.stack && (
                <div>
                  <h3 className="font-semibold mb-2">Stack Trace</h3>
                  <ScrollArea className="h-40">
                    <pre className="text-xs bg-black text-green-400 p-3 rounded overflow-x-auto">
                      {selectedError.stack}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Metadata</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>ID:</strong> {selectedError.id}
                    </p>
                    <p>
                      <strong>Timestamp:</strong> {new Date(selectedError.timestamp).toLocaleString()}
                    </p>
                    {selectedError.endpoint && (
                      <p>
                        <strong>Endpoint:</strong> {selectedError.endpoint}
                      </p>
                    )}
                    {selectedError.method && (
                      <p>
                        <strong>Method:</strong> {selectedError.method}
                      </p>
                    )}
                    {selectedError.userId && (
                      <p>
                        <strong>User ID:</strong> {selectedError.userId}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Request Info</h3>
                  <div className="space-y-1 text-sm">
                    {selectedError.ip && (
                      <p>
                        <strong>IP:</strong> {selectedError.ip}
                      </p>
                    )}
                    {selectedError.userAgent && (
                      <p>
                        <strong>User Agent:</strong> {selectedError.userAgent.substring(0, 50)}...
                      </p>
                    )}
                    {selectedError.metadata && (
                      <div>
                        <strong>Additional Data:</strong>
                        <pre className="text-xs bg-muted p-2 rounded mt-1">
                          {JSON.stringify(selectedError.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
