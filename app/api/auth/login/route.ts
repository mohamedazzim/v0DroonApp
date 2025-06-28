import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/store"
import { validateEmail, sanitizeInput } from "@/lib/validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = sanitizeInput(body.email || "")
    const password = sanitizeInput(body.password || "")

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Get user from store
    const user = dataStore.getUserByEmail(email)

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Demo password validation - in production, use proper password hashing (bcrypt)
    const validPasswords = ["password123", "demo123", "admin123"]
    if (!validPasswords.includes(password)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Update last login
    dataStore.updateUserLastLogin(user.id)

    // Return user data (excluding sensitive information)
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
    }

    return NextResponse.json(safeUser)
  } catch (error) {
    console.error("Login failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
