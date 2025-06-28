"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/loading-spinner"
import { useToast } from "@/hooks/use-toast"

interface RazorpayCheckoutProps {
  bookingId: number
  amount: number
  currency: string
  onSuccess: (paymentData: any) => void
  onError: (error: any) => void
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export function RazorpayCheckout({ bookingId, amount, currency, onSuccess, onError }: RazorpayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const createPaymentOrder = async () => {
    try {
      const token = localStorage.getItem("session_token")
      if (!token) {
        throw new Error("Please login to continue")
      }

      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || "Failed to create payment order")
      }

      return data.data
    } catch (error) {
      console.error("Create payment order error:", error)
      throw error
    }
  }

  const verifyPayment = async (paymentData: any) => {
    try {
      const response = await fetch("/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || "Payment verification failed")
      }

      return data
    } catch (error) {
      console.error("Payment verification error:", error)
      throw error
    }
  }

  const handlePayment = async () => {
    try {
      setIsLoading(true)

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway")
      }

      // Create payment order
      const orderData = await createPaymentOrder()

      // Configure Razorpay options
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Drone Service Pro",
        description: `Booking Payment - ${bookingId}`,
        order_id: orderData.razorpay_order_id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verificationResult = await verifyPayment(response)

            toast({
              title: "Payment Successful",
              description: "Your booking has been confirmed!",
            })

            onSuccess({
              ...verificationResult,
              transaction_id: orderData.transaction_id,
            })
          } catch (error: any) {
            toast({
              title: "Payment Verification Failed",
              description: error.message,
              variant: "destructive",
            })
            onError(error)
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        notes: {
          booking_id: bookingId,
          transaction_id: orderData.transaction_id,
        },
        theme: {
          color: "#667eea",
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false)
            toast({
              title: "Payment Cancelled",
              description: "Payment was cancelled by user",
              variant: "destructive",
            })
          },
        },
      }

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error: any) {
      console.error("Payment error:", error)
      toast({
        title: "Payment Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
      onError(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Complete Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold">₹{(amount / 100).toLocaleString("en-IN")}</div>
          <div className="text-sm text-muted-foreground">Booking ID: {bookingId}</div>
        </div>

        <Button onClick={handlePayment} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            "Pay Now"
          )}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          Secured by Razorpay • Your payment information is safe and encrypted
        </div>
      </CardContent>
    </Card>
  )
}
