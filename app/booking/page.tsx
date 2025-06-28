"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, DollarSign, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { LocationPicker } from "@/components/location-picker"
import { validateBooking, getAvailableTimeSlots } from "@/lib/validation"
import { ErrorMessage } from "@/components/error-message"
import { LoadingSpinner } from "@/components/loading-spinner"

interface Service {
  id: number
  name: string
  price_per_hour: number
}

export default function BookingPage() {
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [bookingData, setBookingData] = useState({
    location: "",
    coordinates: null as { lat: number; lng: number } | null,
    date: "",
    timeSlot: "",
    duration: 1,
    customNeeds: "",
  })
  const [totalCost, setTotalCost] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [availableTimeSlots, setAvailableTimeSlots] = useState<
    Array<{ value: string; disabled: boolean; label: string }>
  >([])
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    // Check authentication
    const userId = localStorage.getItem("userId")
    if (!userId) {
      router.push("/")
      return
    }

    const name = localStorage.getItem("userName")
    if (name) {
      setUserName(name)
    }
    loadSelectedServices()
  }, [router])

  useEffect(() => {
    calculateTotalCost()
  }, [selectedServices, bookingData.duration])

  // Update available time slots when date changes
  useEffect(() => {
    if (bookingData.date) {
      const slots = getAvailableTimeSlots(bookingData.date)
      setAvailableTimeSlots(slots)

      // Clear selected time slot if it becomes disabled
      if (bookingData.timeSlot) {
        const selectedSlot = slots.find((slot) => slot.value === bookingData.timeSlot)
        if (selectedSlot?.disabled) {
          setBookingData((prev) => ({ ...prev, timeSlot: "" }))
        }
      }
    } else {
      setAvailableTimeSlots([])
    }
  }, [bookingData.date])

  const loadSelectedServices = async () => {
    try {
      const serviceIds = JSON.parse(localStorage.getItem("selectedServices") || "[]")
      if (serviceIds.length === 0) {
        router.push("/services")
        return
      }

      const response = await fetch("/api/services")
      if (!response.ok) {
        throw new Error("Failed to fetch services")
      }

      const allServices = await response.json()
      const selected = allServices.filter((service: Service) => serviceIds.includes(service.id))

      if (selected.length === 0) {
        router.push("/services")
        return
      }

      setSelectedServices(selected)
    } catch (error) {
      console.error("Failed to load services:", error)
      setError("Failed to load services. Please try again.")
    } finally {
      setIsPageLoading(false)
    }
  }

  const calculateTotalCost = () => {
    const cost = selectedServices.reduce((total, service) => {
      return total + service.price_per_hour * bookingData.duration
    }, 0)
    setTotalCost(cost)
  }

  const handleInputChange = (field: string, value: string | number) => {
    setBookingData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user makes changes
    if (error) setError("")
  }

  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    setBookingData((prev) => ({
      ...prev,
      location,
      coordinates: coordinates || null,
    }))

    // Clear error when user makes changes
    if (error) setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Validate booking data
      const validation = validateBooking(bookingData)
      if (!validation.isValid) {
        setError(validation.errors.join(", "))
        setIsLoading(false)
        return
      }

      // Additional validation
      if (!bookingData.location.trim()) {
        setError("Please enter a service location")
        setIsLoading(false)
        return
      }

      if (!bookingData.timeSlot) {
        setError("Please select a time slot")
        setIsLoading(false)
        return
      }

      // Store booking data for bill page
      const bookingDetails = {
        selectedServices,
        bookingData,
        totalCost,
      }
      localStorage.setItem("pendingBooking", JSON.stringify(bookingDetails))
      router.push("/bill")
    } catch (error) {
      console.error("Booking submission error:", error)
      setError("An error occurred while processing your booking. Please try again.")
      setIsLoading(false)
    }
  }

  // Calculate minimum date (24 hours from now)
  const getMinDate = () => {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    return tomorrow.toISOString().split("T")[0]
  }

  // Calculate maximum date (1 year from now)
  const getMaxDate = () => {
    const now = new Date()
    const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    return nextYear.toISOString().split("T")[0]
  }

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading booking form...</p>
        </div>
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
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center mb-8">
            <Button variant="ghost" onClick={() => router.back()} className="mr-4 p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Book Your Drone Service</h1>
              <p className="text-gray-600">Complete your booking details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Booking Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Booking Details</CardTitle>
                  <CardDescription>Please provide the details for your drone service booking</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <ErrorMessage message={error} onDismiss={() => setError("")} className="mb-4" />}

                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                        Service Location *
                      </Label>
                      <LocationPicker
                        value={bookingData.location}
                        onChange={handleLocationChange}
                        placeholder="Enter the location for drone service"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        You can type an address, use current location, or click on the map to select a precise location
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                          Booking Date *
                        </Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="date"
                            type="date"
                            required
                            className="pl-10 h-12"
                            min={getMinDate()}
                            max={getMaxDate()}
                            value={bookingData.date}
                            onChange={(e) => handleInputChange("date", e.target.value)}
                          />
                        </div>
                        <div className="flex items-start space-x-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>Booking must be at least 24 hours in advance</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timeSlot" className="text-sm font-medium text-gray-700">
                          Time Slot *
                        </Label>
                        <Select
                          value={bookingData.timeSlot}
                          onValueChange={(value) => handleInputChange("timeSlot", value)}
                        >
                          <SelectTrigger className="h-12">
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-gray-400" />
                              <SelectValue placeholder="Select time slot" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {availableTimeSlots.length > 0 ? (
                              availableTimeSlots.map((slot) => (
                                <SelectItem
                                  key={slot.value}
                                  value={slot.value}
                                  disabled={slot.disabled}
                                  className={slot.disabled ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>{slot.value}</span>
                                    {slot.disabled && <span className="text-xs text-red-500 ml-2">(Unavailable)</span>}
                                    {!slot.disabled && <CheckCircle className="w-3 h-3 text-green-500 ml-2" />}
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                {bookingData.date
                                  ? "No available time slots for this date"
                                  : "Select a date first to see available time slots"}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        {bookingData.date && (
                          <p className="text-xs text-gray-500">
                            {availableTimeSlots.filter((slot) => !slot.disabled).length} of {availableTimeSlots.length}{" "}
                            time slots available
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration" className="text-sm font-medium text-gray-700">
                        Duration (Hours) *
                      </Label>
                      <Select
                        value={bookingData.duration.toString()}
                        onValueChange={(value) => handleInputChange("duration", Number.parseInt(value))}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {hour} hour{hour > 1 ? "s" : ""} - $
                              {(
                                selectedServices.reduce((total, service) => total + service.price_per_hour, 0) * hour
                              ).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customNeeds" className="text-sm font-medium text-gray-700">
                        Custom Requirements (Optional)
                      </Label>
                      <Textarea
                        id="customNeeds"
                        className="min-h-[100px]"
                        placeholder="Any specific requirements or notes for your drone service..."
                        value={bookingData.customNeeds}
                        onChange={(e) => handleInputChange("customNeeds", e.target.value)}
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-500">{bookingData.customNeeds.length}/500 characters</p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || !bookingData.location.trim() || !bookingData.date || !bookingData.timeSlot}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <LoadingSpinner size="sm" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        "Continue to Payment"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Booking Summary */}
            <div className="lg:col-span-1">
              <Card className="shadow-lg border-0 sticky top-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Booking Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Selected Services:</h4>
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-gray-600">${service.price_per_hour}/hour</p>
                        </div>
                        <p className="font-semibold">${(service.price_per_hour * bookingData.duration).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">
                        {bookingData.duration} hour{bookingData.duration > 1 ? "s" : ""}
                      </span>
                    </div>

                    {bookingData.date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{new Date(bookingData.date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {bookingData.timeSlot && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Time:</span>
                        <span className="font-medium">{bookingData.timeSlot}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                      <span>Total Cost:</span>
                      <span className="text-blue-600">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>

                  {bookingData.location && (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 font-medium mb-1">Service Location:</p>
                      <p className="text-sm text-green-800">{bookingData.location}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
