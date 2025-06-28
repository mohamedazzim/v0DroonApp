// Enhanced data store with production-ready features
interface User {
  id: number
  full_name: string
  email: string
  phone: string
  created_at: string
  last_login?: string
  status: "active" | "inactive" | "suspended"
}

interface Service {
  id: number
  name: string
  description: string
  price_per_hour: number
  icon: string
  created_at: string
  status: "active" | "inactive"
}

interface Booking {
  id: number
  user_id: number
  service_id: number
  location: string
  booking_date: string
  time_slot: string
  duration_hours: number
  total_cost: number
  status: string
  custom_needs?: string
  payment_type?: string
  payment_id?: string
  created_at: string
  updated_at?: string
  // Joined fields
  service_name?: string
  user_name?: string
}

class DataStore {
  private static instance: DataStore
  private users: User[] = []
  private services: Service[] = []
  private bookings: Booking[] = []
  private nextUserId = 1
  private nextServiceId = 7
  private nextBookingId = 1

  private constructor() {
    this.initializeData()
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore()
    }
    return DataStore.instance
  }

  private initializeData() {
    // Initialize services with status
    this.services = [
      {
        id: 1,
        name: "Drone for Videography",
        description: "Professional aerial videography for events, real estate, and commercial projects",
        price_per_hour: 150.0,
        icon: "video",
        created_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: 2,
        name: "Drone for Photoshoot",
        description: "High-quality aerial photography for weddings, portraits, and landscapes",
        price_per_hour: 120.0,
        icon: "camera",
        created_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: 3,
        name: "Drone for Agriculture",
        description: "Crop monitoring, field mapping, and precision agriculture services",
        price_per_hour: 200.0,
        icon: "wheat",
        created_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: 4,
        name: "Drone for Surveillance",
        description: "Security monitoring and surveillance for properties and events",
        price_per_hour: 180.0,
        icon: "shield",
        created_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: 5,
        name: "Drone for Inspection",
        description: "Infrastructure inspection for buildings, towers, and industrial facilities",
        price_per_hour: 220.0,
        icon: "search",
        created_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: 6,
        name: "Drone for Custom Needs",
        description: "Customized drone services tailored to your specific requirements",
        price_per_hour: 175.0,
        icon: "settings",
        created_at: new Date().toISOString(),
        status: "active",
      },
    ]

    // Initialize demo users with enhanced fields
    this.users = [
      {
        id: 1,
        full_name: "Demo User",
        email: "user@demo.com",
        phone: "+1234567890",
        created_at: "2024-01-15T10:30:00Z",
        status: "active",
      },
      {
        id: 2,
        full_name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        created_at: "2024-01-15T10:30:00Z",
        status: "active",
      },
      {
        id: 3,
        full_name: "Jane Smith",
        email: "jane@example.com",
        phone: "+1987654321",
        created_at: "2024-01-20T14:45:00Z",
        status: "active",
      },
    ]
    this.nextUserId = 4

    // Initialize sample bookings
    this.bookings = [
      {
        id: 1,
        user_id: 1,
        service_id: 1,
        location: "123 Main St, New York, NY",
        booking_date: "2024-12-30",
        time_slot: "10:00 AM",
        duration_hours: 2,
        total_cost: 300.0,
        status: "confirmed",
        created_at: "2024-01-25T10:30:00Z",
      },
      {
        id: 2,
        user_id: 2,
        service_id: 2,
        location: "456 Oak Ave, Los Angeles, CA",
        booking_date: "2024-12-31",
        time_slot: "02:00 PM",
        duration_hours: 3,
        total_cost: 360.0,
        status: "pending",
        created_at: "2024-01-28T15:20:00Z",
      },
    ]
    this.nextBookingId = 3
  }

  // Enhanced user methods
  createUser(userData: Omit<User, "id" | "created_at" | "status">): User {
    const existingUser = this.users.find((user) => user.email.toLowerCase() === userData.email.toLowerCase())
    if (existingUser) {
      throw new Error("User with this email already exists")
    }

    const newUser: User = {
      id: this.nextUserId++,
      ...userData,
      created_at: new Date().toISOString(),
      status: "active",
    }
    this.users.push(newUser)
    return newUser
  }

  getUsers(): User[] {
    return [...this.users]
  }

  getUserById(id: number): User | undefined {
    return this.users.find((user) => user.id === id)
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase())
  }

  updateUserLastLogin(id: number): void {
    const userIndex = this.users.findIndex((user) => user.id === id)
    if (userIndex !== -1) {
      this.users[userIndex].last_login = new Date().toISOString()
    }
  }

  // Enhanced service methods
  getServices(): Service[] {
    return this.services.filter((service) => service.status === "active")
  }

  getAllServices(): Service[] {
    return [...this.services]
  }

  getServiceById(id: number): Service | undefined {
    return this.services.find((service) => service.id === id)
  }

  createService(serviceData: Omit<Service, "id" | "created_at" | "status">): Service {
    const newService: Service = {
      id: this.nextServiceId++,
      ...serviceData,
      created_at: new Date().toISOString(),
      status: "active",
    }
    this.services.push(newService)
    return newService
  }

  updateService(id: number, serviceData: Partial<Service>): Service | null {
    const index = this.services.findIndex((service) => service.id === id)
    if (index === -1) return null

    this.services[index] = {
      ...this.services[index],
      ...serviceData,
      updated_at: new Date().toISOString(),
    }
    return this.services[index]
  }

  deleteService(id: number): boolean {
    const index = this.services.findIndex((service) => service.id === id)
    if (index === -1) return false

    // Soft delete - mark as inactive instead of removing
    this.services[index].status = "inactive"
    return true
  }

  // Enhanced booking methods
  createBooking(bookingData: Omit<Booking, "id" | "created_at">): Booking {
    const newBooking: Booking = {
      id: this.nextBookingId++,
      ...bookingData,
      created_at: new Date().toISOString(),
    }
    this.bookings.push(newBooking)
    return newBooking
  }

  getBookings(): Booking[] {
    return this.bookings.map((booking) => {
      const service = this.getServiceById(booking.service_id)
      const user = this.getUserById(booking.user_id)
      return {
        ...booking,
        service_name: service?.name || "Unknown Service",
        user_name: user?.full_name || "Unknown User",
      }
    })
  }

  getBookingsByUserId(userId: number): Booking[] {
    return this.bookings
      .filter((booking) => booking.user_id === userId)
      .map((booking) => {
        const service = this.getServiceById(booking.service_id)
        return {
          ...booking,
          service_name: service?.name || "Unknown Service",
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  updateBookingStatus(id: number, status: string): Booking | null {
    const index = this.bookings.findIndex((booking) => booking.id === id)
    if (index === -1) return null

    this.bookings[index] = {
      ...this.bookings[index],
      status,
      updated_at: new Date().toISOString(),
    }

    const service = this.getServiceById(this.bookings[index].service_id)
    const user = this.getUserById(this.bookings[index].user_id)

    return {
      ...this.bookings[index],
      service_name: service?.name || "Unknown Service",
      user_name: user?.full_name || "Unknown User",
    }
  }

  // Analytics methods
  getStats() {
    const totalUsers = this.users.filter((u) => u.status === "active").length
    const totalBookings = this.bookings.length
    const totalRevenue = this.bookings
      .filter((b) => b.status === "completed" || b.status === "paid")
      .reduce((sum, b) => sum + b.total_cost, 0)
    const activeServices = this.services.filter((s) => s.status === "active").length

    return {
      totalUsers,
      totalBookings,
      totalRevenue,
      activeServices,
      recentBookings: this.bookings
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    }
  }
}

export const dataStore = DataStore.getInstance()
