import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const swaggerSpec = {
    openapi: "3.0.0",
    info: {
      title: "Drone Booking API",
      version: "1.0.0",
      description: "Premium Drone Booking Service API Documentation",
      contact: {
        name: "API Support",
        email: "support@dronebooking.com",
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
        description: "Development server",
      },
    ],
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "User login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      token: { type: "string" },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          email: { type: "string" },
                          name: { type: "string" },
                          role: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
            },
          },
        },
      },
      "/api/bookings": {
        get: {
          tags: ["Bookings"],
          summary: "Get user bookings",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["pending", "confirmed", "completed", "cancelled"] },
            },
          ],
          responses: {
            "200": {
              description: "Bookings retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      bookings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            service_id: { type: "integer" },
                            user_id: { type: "integer" },
                            booking_date: { type: "string", format: "date" },
                            booking_time: { type: "string", format: "time" },
                            location_address: { type: "string" },
                            status: { type: "string" },
                            total_amount: { type: "number" },
                            created_at: { type: "string", format: "date-time" },
                          },
                        },
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          current_page: { type: "integer" },
                          total_pages: { type: "integer" },
                          total_items: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Bookings"],
          summary: "Create new booking",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    service_id: { type: "integer" },
                    booking_date: { type: "string", format: "date" },
                    booking_time: { type: "string", format: "time" },
                    duration: { type: "integer" },
                    location_address: { type: "string" },
                    location_lat: { type: "number" },
                    location_lng: { type: "number" },
                    special_requirements: { type: "string" },
                  },
                  required: ["service_id", "booking_date", "booking_time", "location_address"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Booking created successfully",
            },
          },
        },
      },
      "/api/services": {
        get: {
          tags: ["Services"],
          summary: "Get available services",
          parameters: [
            {
              name: "category",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "location",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Services retrieved successfully",
            },
          },
        },
      },
      "/api/payment/create-order": {
        post: {
          tags: ["Payment"],
          summary: "Create payment order",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    booking_id: { type: "integer" },
                    amount: { type: "number" },
                    currency: { type: "string", default: "INR" },
                  },
                  required: ["booking_id", "amount"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Payment order created successfully",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            error_code: { type: "string" },
          },
        },
      },
    },
  }

  return NextResponse.json(swaggerSpec)
}
