import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/store"
import { validateBooking, sanitizeInput } from "@/lib/validation"

export async function POST(request: NextRequest) {
  try {
    const bookingData = await request.json()

    // Validate required fields
    if (
      !bookingData.userId ||
      !bookingData.serviceId ||
      !bookingData.location ||
      !bookingData.date ||
      !bookingData.timeSlot ||
      !bookingData.duration
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedData = {
      location: sanitizeInput(bookingData.location),
      date: bookingData.date,
      timeSlot: bookingData.timeSlot,
      duration: Number.parseInt(bookingData.duration),
      customNeeds: sanitizeInput(bookingData.customNeeds || ""),
    }

    // Validate booking data
    const validation = validateBooking(sanitizedData)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors.join(", ") }, { status: 400 })
    }

    // Verify user exists
    const user = dataStore.getUserById(bookingData.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify service exists
    const service = dataStore.getServiceById(bookingData.serviceId)
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const newBooking = dataStore.createBooking({
      user_id: bookingData.userId,
      service_id: bookingData.serviceId,
      location: sanitizedData.location,
      booking_date: sanitizedData.date,
      time_slot: sanitizedData.timeSlot,
      duration_hours: sanitizedData.duration,
      total_cost: bookingData.totalCost || service.price_per_hour * sanitizedData.duration,
      status: "pending",
      custom_needs: sanitizedData.customNeeds,
      payment_type: bookingData.paymentType,
      payment_id: bookingData.paymentId,
    })

    return NextResponse.json(newBooking, { status: 201 })
  } catch (error) {
    console.error("Booking creation failed:", error)
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (userId) {
      const userIdNum = Number.parseInt(userId)
      if (isNaN(userIdNum)) {
        return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
      }

      const userBookings = dataStore.getBookingsByUserId(userIdNum)
      return NextResponse.json(userBookings)
    }

    const allBookings = dataStore.getBookings()
    return NextResponse.json(allBookings)
  } catch (error) {
    console.error("Failed to fetch bookings:", error)
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 })
  }
}
