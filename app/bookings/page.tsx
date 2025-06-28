"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, MapPin, Clock, DollarSign, Plus, CheckCircle, XCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"

interface Booking {
  id: number
  service_name: string
  location: string
  booking_date: string
  time_slot: string
  duration_hours: number
  total_cost: number
  status: string
  custom_needs?: string
  created_at: string
}

interface PaymentResult {
  success: boolean
  message: string
  bookingId?: number
  notifications?: {
    emailSent: boolean
    smsSent: boolean
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem("userName")
    if (name) {
      setUserName(name)
    }

    // Check for payment result
    const result = localStorage.getItem("paymentResult")
    if (result) {
      setPaymentResult(JSON.parse(result))
      localStorage.removeItem("paymentResult")
    }

    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    const userId = localStorage.getItem("userId")
    if (!userId) {
      router.push("/")
      return
    }

    try {
      const response = await fetch(`/api/bookings?userId=${userId}`)
      const data = await response.json()
      setBookings(data)
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "paid":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const dismissPaymentResult = () => {
    setPaymentResult(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url(/images/booking-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <Navigation userName={userName} />
      <div className="absolute inset-0 bg-black/20 z-0"></div>

      <div className="relative z-10 py-8 pt-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Bookings</h1>
              <p className="text-gray-200">Welcome back, {userName}</p>
            </div>
            <Button
              onClick={() => router.push("/services")}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Booking</span>
            </Button>
          </div>

          {/* Payment Result Alert */}
          {paymentResult && (
            <Alert
              className={`mb-6 ${paymentResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  {paymentResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <AlertDescription className={paymentResult.success ? "text-green-800" : "text-red-800"}>
                      <strong>{paymentResult.success ? "Payment Successful!" : "Payment Failed"}</strong>
                      <br />
                      {paymentResult.message}
                      {paymentResult.notifications && (
                        <div className="mt-2 text-sm">
                          📧 Email notification: {paymentResult.notifications.emailSent ? "Sent" : "Failed"}
                          <br />📱 SMS notification: {paymentResult.notifications.smsSent ? "Sent" : "Failed"}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={dismissPaymentResult} className="p-1 h-auto">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Alert>
          )}

          {bookings.length === 0 ? (
            <Card className="text-center py-12 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
              <CardContent>
                <div className="mb-4">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings yet</h3>
                <p className="text-gray-600 mb-6">Start by booking your first drone service</p>
                <Button onClick={() => router.push("/services")} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Book Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="shadow-2xl border-0 hover:shadow-3xl transition-all duration-300 bg-white/95 backdrop-blur-sm"
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold text-gray-900">{booking.service_name}</CardTitle>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-gray-600">Booking #{booking.id}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{booking.location}</span>
                      </div>

                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{formatDate(booking.booking_date)}</span>
                      </div>

                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        <span>
                          {booking.time_slot} ({booking.duration_hours} hour{booking.duration_hours > 1 ? "s" : ""})
                        </span>
                      </div>

                      <div className="flex items-center text-sm font-semibold text-blue-600">
                        <DollarSign className="w-4 h-4 mr-2" />
                        <span>${booking.total_cost.toFixed(2)}</span>
                      </div>
                    </div>

                    {booking.custom_needs && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">Custom Requirements:</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{booking.custom_needs}</p>
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        Booked on {new Date(booking.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
