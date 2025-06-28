import { NextResponse } from "next/server"
import { dataStore } from "@/lib/store"

export async function GET() {
  try {
    const users = dataStore.getUsers()
    return NextResponse.json(users)
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
