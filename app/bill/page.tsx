"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Navigation } from "@/components/navigation"
import { CreditCard, Receipt, Calendar, MapPin, Clock, DollarSign, CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { ErrorMessage } from "@/components/error-message"
import { LoadingSpinner } from "@/components/loading-spinner"

interface Service {
  id: number
  name: string
  price_per_hour: number
}

interface BookingData {
  location: string
  date: string
  timeSlot: string
  duration: number
  customNeeds: string
}

interface BookingDetails {
  selectedServices: Service[]
  bookingData: BookingData
  totalCost: number
}

export default function BillPage() {
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null)
  const [userName, setUserName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem("userName")
    if (name) {
      setUserName(name)
    }

    const pendingBooking = localStorage.getItem("pendingBooking")
    if (pendingBooking) {
      setBookingDetails(JSON.parse(pendingBooking))
    } else {
      router.push("/services")
    }
  }, [router])

  // Check if Razorpay script is loaded
  useEffect(() => {
    const checkRazorpayScript = () => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        setScriptLoaded(true)
      } else {
        setTimeout(checkRazorpayScript, 100)
      }
    }
    checkRazorpayScript()
  }, [])

  const handlePayment = async (type: "advance" | "full") => {
    if (!bookingDetails) return

    if (!scriptLoaded) {
      setError("Payment system is loading. Please try again in a moment.")
      return
    }

    setIsProcessing(true)
    setError("")

    const paymentAmount =
      type === "advance"
        ? Math.round(bookingDetails.totalCost * 0.3 * 83) // 30% in INR (approximate conversion)
        : Math.round(bookingDetails.totalCost * 83) // Full amount in INR

    try {
      // Create order on backend
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentAmount * 100, // Convert to paise
          currency: "INR",
          receipt: `booking_${Date.now()}`,
          bookingDetails,
          paymentType: type,
        }),
      })

      if (!orderResponse.ok) {
        throw new Error("Failed to create payment order")
      }

      const orderData = await orderResponse.json()

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order")
      }

      // Initialize Razorpay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_Jnc1rwSBhtZKvq",
        amount: paymentAmount * 100,
        currency: "INR",
        name: "SkyVision Pro",
        description: `Drone Service Booking - ${type === "advance" ? "Advance" : "Full"} Payment`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment and create booking
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingDetails,
                paymentType: type,
              }),
            })

            const verifyData = await verifyResponse.json()

            if (verifyData.success) {
              localStorage.removeItem("pendingBooking")
              localStorage.setItem(
                "paymentResult",
                JSON.stringify({
                  success: true,
                  message: "Payment successful! Booking confirmed.",
                  bookingId: verifyData.bookings[0]?.id,
                  notifications: verifyData.notifications,
                }),
              )
              router.push("/bookings")
            } else {
              localStorage.setItem(
                "paymentResult",
                JSON.stringify({
                  success: false,
                  message: "Payment verification failed. Please contact support.",
                  notifications: verifyData.notifications,
                }),
              )
              router.push("/bookings")
            }
          } catch (error) {
            localStorage.setItem(
              "paymentResult",
              JSON.stringify({
                success: false,
                message: "Payment verification failed. Please contact support.",
              }),
            )
            router.push("/bookings")
          }
        },
        prefill: {
          name: userName,
          email: localStorage.getItem("userEmail") || "",
          contact: localStorage.getItem("userPhone") || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            // Handle payment cancellation
            localStorage.setItem(
              "paymentResult",
              JSON.stringify({
                success: false,
                message: "Payment was cancelled by user.",
              }),
            )
            router.push("/bookings")
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error("Payment failed:", error)
      setError("Payment failed. Please try again.")
      setIsProcessing(false)
    }
  }

  if (!bookingDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const advanceAmount = bookingDetails.totalCost * 0.3
  const remainingAmount = bookingDetails.totalCost - advanceAmount

  return (
    <>
      {/* Add Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

      <div
        className="min-h-screen relative"
        style={{
          backgroundImage: "url(/images/payment-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <Navigation userName={userName} />
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        <div className="relative z-10 py-8 pt-24">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Booking Summary & Payment</h1>
              <p className="text-gray-200">Review your booking details and choose payment option</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Booking Details */}
              <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                    Booking Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Services */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Selected Services</h4>
                    <div className="space-y-3">
                      {bookingDetails.selectedServices.map((service) => (
                        <div key={service.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-gray-600">
                              ${service.price_per_hour}/hour × {bookingDetails.bookingData.duration}h
                            </p>
                          </div>
                          <p className="font-semibold text-blue-600">
                            ${(service.price_per_hour * bookingDetails.bookingData.duration).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Booking Info */}
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                      <span>{bookingDetails.bookingData.location}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                      <span>
                        {new Date(bookingDetails.bookingData.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-3 text-gray-400" />
                      <span>
                        {bookingDetails.bookingData.timeSlot} ({bookingDetails.bookingData.duration} hours)
                      </span>
                    </div>
                  </div>

                  {bookingDetails.bookingData.customNeeds && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Custom Requirements</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {bookingDetails.bookingData.customNeeds}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Amount:</span>
                    <span className="text-blue-600">${bookingDetails.totalCost.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Options */}
              <div className="space-y-6">
                {error && <ErrorMessage message={error} onDismiss={() => setError("")} className="mb-6" />}

                {/* Advance Payment Option */}
                <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm hover:shadow-3xl transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                        Advance Payment (30%)
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Recommended
                      </Badge>
                    </CardTitle>
                    <CardDescription>Pay 30% now and remaining 70% after service completion</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Pay Now:</span>
                        <span className="text-xl font-bold text-green-600">${advanceAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Pay Later:</span>
                        <span className="text-sm font-medium text-gray-700">${remainingAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Secure your booking with minimal upfront cost</span>
                    </div>
                    <Button
                      onClick={() => handlePayment("advance")}
                      disabled={isProcessing}
                      className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-medium"
                    >
                      {isProcessing ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Processing...
                        </>
                      ) : (
                        `Pay ₹${(advanceAmount * 83).toFixed(0)} Now`
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Full Payment Option */}
                <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm hover:shadow-3xl transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                      Full Payment
                    </CardTitle>
                    <CardDescription>Pay the complete amount now and enjoy peace of mind</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Amount:</span>
                        <span className="text-xl font-bold text-blue-600">${bookingDetails.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>Complete payment - no additional charges later</span>
                    </div>
                    <Button
                      onClick={() => handlePayment("full")}
                      disabled={isProcessing}
                      variant="outline"
                      className="w-full border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white h-12 text-lg font-medium"
                    >
                      {isProcessing ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Processing...
                        </>
                      ) : (
                        `Pay ₹${(bookingDetails.totalCost * 83).toFixed(0)} Now`
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Security Notice */}
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 mb-1">Secure Payment</p>
                        <p className="text-yellow-700">
                          All payments are processed securely through Razorpay. Your card details are never stored on
                          our servers. You will receive SMS and email notifications.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
