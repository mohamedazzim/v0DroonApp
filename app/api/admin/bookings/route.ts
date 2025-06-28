import { NextResponse } from "next/server"
import { dataStore } from "@/lib/store"

export async function GET() {
  try {
    const bookings = dataStore.getBookings()
    return NextResponse.json(bookings)
  } catch (error) {
    console.error("Failed to fetch bookings:", error)
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 })
  }
}
