import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/store"
import { sanitizeInput } from "@/lib/validation"

export async function GET() {
  try {
    const services = dataStore.getServices()
    return NextResponse.json(services, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("Failed to fetch services:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceData = await request.json()

    // Validate required fields
    if (!serviceData.name || !serviceData.description || !serviceData.price_per_hour) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitizeInput(serviceData.name),
      description: sanitizeInput(serviceData.description),
      price_per_hour: Number.parseFloat(serviceData.price_per_hour),
      icon: sanitizeInput(serviceData.icon || "settings"),
    }

    // Validate price
    if (isNaN(sanitizedData.price_per_hour) || sanitizedData.price_per_hour <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 })
    }

    const newService = dataStore.createService(sanitizedData)

    return NextResponse.json(newService, { status: 201 })
  } catch (error) {
    console.error("Service creation failed:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
