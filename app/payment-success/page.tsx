"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Navigation } from "@/components/navigation"
import { CheckCircle, Calendar, Home, MapPin, Clock } from "lucide-react"
import { useRouter } from "next/navigation"

interface BookingDetails {
  id: string
  serviceName: string
  location: string
  date: string
  timeSlot: string
  duration: number
  totalCost: number
  paymentType: string
}

export default function PaymentSuccessPage() {
  const [userName, setUserName] = useState("")
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null)
  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem("userName")
    if (name) {
      setUserName(name)
    }

    // Get booking details from localStorage or generate mock data
    const pendingBooking = localStorage.getItem("pendingBooking")
    if (pendingBooking) {
      const booking = JSON.parse(pendingBooking)
      const mockBookingDetails: BookingDetails = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        serviceName: booking.selectedServices.map((s: any) => s.name).join(", "),
        location: booking.bookingData.location,
        date: booking.bookingData.date,
        timeSlot: booking.bookingData.timeSlot,
        duration: booking.bookingData.duration,
        totalCost: booking.totalCost,
        paymentType: "advance", // This would come from the payment flow
      }
      setBookingDetails(mockBookingDetails)
    }
  }, [])

  const handleViewBookings = () => {
    router.push("/bookings")
  }

  const handleBookAnother = () => {
    router.push("/services")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url(/images/payment-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <Navigation userName={userName} showBackButton={false} />
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 pt-24">
        <div className="w-full max-w-2xl">
          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="p-4 bg-green-100 rounded-full">
                    <CheckCircle className="w-16 h-16 text-green-600" />
                  </div>
                  <div className="absolute -inset-2 bg-green-200 rounded-full opacity-30 animate-ping"></div>
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</CardTitle>
              <CardDescription className="text-lg text-gray-600">
                Your drone service booking has been confirmed successfully
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Booking Reference */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl text-center border border-green-200">
                <p className="text-sm text-gray-600 mb-2">Booking Reference</p>
                <p className="text-2xl font-bold text-green-800">
                  #{bookingDetails?.id || "SKY" + Math.random().toString(36).substr(2, 6).toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 mt-2">Save this reference number for future communication</p>
              </div>

              {/* Booking Details Summary */}
              {bookingDetails && (
                <div className="bg-gray-50 p-6 rounded-xl space-y-4">
                  <h3 className="font-semibold text-gray-900 text-lg mb-4">Booking Summary</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Date & Time</p>
                          <p className="font-medium text-gray-900">{formatDate(bookingDetails.date)}</p>
                          <p className="text-sm text-gray-700">{bookingDetails.timeSlot}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Duration</p>
                          <p className="font-medium text-gray-900">
                            {bookingDetails.duration} hour{bookingDetails.duration > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-medium text-gray-900 text-sm">{bookingDetails.location}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 bg-blue-600 rounded-full mt-0.5 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">$</span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="font-bold text-gray-900 text-lg">${bookingDetails.totalCost.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            {bookingDetails.paymentType === "advance"
                              ? "30% paid, 70% due after service"
                              : "Fully paid"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleViewBookings}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 flex items-center justify-center space-x-2 text-lg font-medium"
                >
                  <Calendar className="w-5 h-5" />
                  <span>View My Bookings</span>
                </Button>

                <Button
                  onClick={handleBookAnother}
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center space-x-2 text-lg font-medium border-2 bg-transparent"
                >
                  <Home className="w-5 h-5" />
                  <span>Book Another Service</span>
                </Button>
              </div>

              {/* Additional Information */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">What's Next?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You'll receive a confirmation email shortly</li>
                  <li>• Our team will contact you 24 hours before the service</li>
                  <li>• Check weather conditions on the day of service</li>
                  <li>• Ensure the location is accessible for our equipment</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
