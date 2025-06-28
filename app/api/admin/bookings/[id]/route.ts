import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/store"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bookingId = Number.parseInt(params.id)
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 })
    }

    const { status } = await request.json()

    if (!status || !["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updatedBooking = dataStore.updateBookingStatus(bookingId, status)
    if (!updatedBooking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json(updatedBooking)
  } catch (error) {
    console.error("Booking update failed:", error)
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 })
  }
}
