"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, ExternalLink, Book } from "lucide-react"

interface APIEndpoint {
  method: string
  path: string
  description: string
  tags: string[]
  parameters?: any[]
  requestBody?: any
  responses: any
}

export default function APIDocumentation() {
  const [apiSpec, setApiSpec] = useState<any>(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAPISpec()
  }, [])

  const fetchAPISpec = async () => {
    try {
      const response = await fetch("/api/docs")
      const spec = await response.json()
      setApiSpec(spec)

      // Set first endpoint as selected
      const firstPath = Object.keys(spec.paths)[0]
      const firstMethod = Object.keys(spec.paths[firstPath])[0]
      setSelectedEndpoint({
        method: firstMethod.toUpperCase(),
        path: firstPath,
        description: spec.paths[firstPath][firstMethod].summary,
        tags: spec.paths[firstPath][firstMethod].tags || [],
        parameters: spec.paths[firstPath][firstMethod].parameters,
        requestBody: spec.paths[firstPath][firstMethod].requestBody,
        responses: spec.paths[firstPath][firstMethod].responses,
      })
    } catch (error) {
      console.error("Failed to fetch API spec:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getMethodColor = (method: string) => {
    const colors = {
      GET: "bg-green-100 text-green-800",
      POST: "bg-blue-100 text-blue-800",
      PUT: "bg-yellow-100 text-yellow-800",
      DELETE: "bg-red-100 text-red-800",
      PATCH: "bg-purple-100 text-purple-800",
    }
    return colors[method as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const generateCurlExample = (endpoint: APIEndpoint) => {
    let curl = `curl -X ${endpoint.method} \\\n  "${window.location.origin}${endpoint.path}"`

    if (endpoint.method !== "GET" && endpoint.requestBody) {
      curl += ` \\\n  -H "Content-Type: application/json"`
      if (endpoint.requestBody.content?.["application/json"]?.schema?.properties) {
        const example = generateExampleFromSchema(endpoint.requestBody.content["application/json"].schema)
        curl += ` \\\n  -d '${JSON.stringify(example, null, 2)}'`
      }
    }

    curl += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`

    return curl
  }

  const generateExampleFromSchema = (schema: any): any => {
    if (!schema.properties) return {}

    const example: any = {}
    Object.keys(schema.properties).forEach((key) => {
      const prop = schema.properties[key]
      switch (prop.type) {
        case "string":
          example[key] =
            prop.format === "email"
              ? "user@example.com"
              : prop.format === "date"
                ? "2024-01-01"
                : prop.format === "time"
                  ? "10:00"
                  : "example"
          break
        case "integer":
          example[key] = 1
          break
        case "number":
          example[key] = 100.0
          break
        case "boolean":
          example[key] = true
          break
        default:
          example[key] = "example"
      }
    })
    return example
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-96 bg-muted rounded"></div>
            <div className="lg:col-span-2 h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!apiSpec) return null

  const endpoints: APIEndpoint[] = []
  Object.keys(apiSpec.paths).forEach((path) => {
    Object.keys(apiSpec.paths[path]).forEach((method) => {
      const endpoint = apiSpec.paths[path][method]
      endpoints.push({
        method: method.toUpperCase(),
        path,
        description: endpoint.summary,
        tags: endpoint.tags || [],
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses,
      })
    })
  })

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Book className="w-8 h-8" />
          API Documentation
        </h1>
        <p className="text-muted-foreground">{apiSpec.info.description}</p>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Version {apiSpec.info.version}</Badge>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Postman Collection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {endpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className={`p-3 cursor-pointer hover:bg-muted/50 border-l-4 ${
                    selectedEndpoint?.path === endpoint.path && selectedEndpoint?.method === endpoint.method
                      ? "border-primary bg-muted/50"
                      : "border-transparent"
                  }`}
                  onClick={() => setSelectedEndpoint(endpoint)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getMethodColor(endpoint.method)}>{endpoint.method}</Badge>
                    <code className="text-sm">{endpoint.path}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  {endpoint.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {endpoint.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Endpoint Details */}
        <div className="lg:col-span-2">
          {selectedEndpoint && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className={getMethodColor(selectedEndpoint.method)}>{selectedEndpoint.method}</Badge>
                  <code className="text-lg">{selectedEndpoint.path}</code>
                </div>
                <p className="text-muted-foreground">{selectedEndpoint.description}</p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="request">Request</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="examples">Examples</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground">{selectedEndpoint.description}</p>
                    </div>

                    {selectedEndpoint.tags.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Tags</h3>
                        <div className="flex gap-2">
                          {selectedEndpoint.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="parameters" className="space-y-4">
                    {selectedEndpoint.parameters ? (
                      <div className="space-y-3">
                        {selectedEndpoint.parameters.map((param: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="font-semibold">{param.name}</code>
                              <Badge variant="outline">{param.in}</Badge>
                              {param.required && <Badge variant="destructive">Required</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{param.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Type: {param.schema?.type || "string"}
                              {param.schema?.default && ` (default: ${param.schema.default})`}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No parameters required</p>
                    )}
                  </TabsContent>

                  <TabsContent value="request" className="space-y-4">
                    {selectedEndpoint.requestBody ? (
                      <div>
                        <h3 className="font-semibold mb-2">Request Body</h3>
                        <div className="bg-muted p-4 rounded-lg">
                          <pre className="text-sm overflow-x-auto">
                            {JSON.stringify(
                              selectedEndpoint.requestBody.content?.["application/json"]?.schema || {},
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No request body required</p>
                    )}
                  </TabsContent>

                  <TabsContent value="response" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Responses</h3>
                      <div className="space-y-3">
                        {Object.keys(selectedEndpoint.responses).map((statusCode) => (
                          <div key={statusCode} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={statusCode.startsWith("2") ? "default" : "destructive"}>
                                {statusCode}
                              </Badge>
                              <span className="font-medium">{selectedEndpoint.responses[statusCode].description}</span>
                            </div>
                            {selectedEndpoint.responses[statusCode].content && (
                              <div className="bg-muted p-2 rounded mt-2">
                                <pre className="text-xs overflow-x-auto">
                                  {JSON.stringify(
                                    selectedEndpoint.responses[statusCode].content?.["application/json"]?.schema || {},
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="examples" className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">cURL Example</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(generateCurlExample(selectedEndpoint))}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                        <pre>{generateCurlExample(selectedEndpoint)}</pre>
                      </div>
                    </div>

                    {selectedEndpoint.requestBody && (
                      <div>
                        <h3 className="font-semibold mb-2">Request Example</h3>
                        <div className="bg-muted p-4 rounded-lg">
                          <pre className="text-sm overflow-x-auto">
                            {JSON.stringify(
                              generateExampleFromSchema(
                                selectedEndpoint.requestBody.content?.["application/json"]?.schema || {},
                              ),
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
