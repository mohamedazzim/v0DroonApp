import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/store"
import { validateUserRegistration, sanitizeInput } from "@/lib/validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Sanitize inputs
    const sanitizedData = {
      full_name: sanitizeInput(body.fullName || ""),
      email: sanitizeInput(body.email || ""),
      phone: sanitizeInput(body.phone || ""),
    }

    // Validate data
    const validation = validateUserRegistration({
      fullName: sanitizedData.full_name,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
    })

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors.join(", ") }, { status: 400 })
    }

    // Check if user already exists
    const existingUsers = dataStore.getUsers()
    const existingUser = existingUsers.find((user) => user.email.toLowerCase() === sanitizedData.email.toLowerCase())

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    // Create user (password would be hashed in production)
    const newUser = dataStore.createUser(sanitizedData)

    return NextResponse.json(newUser)
  } catch (error) {
    console.error("User creation failed:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const users = dataStore.getUsers()
    return NextResponse.json(users)
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
