"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Video, Camera, Wheat, Shield, Search, Settings, ArrowRight, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ErrorMessage } from "@/components/error-message"

const serviceIcons = {
  video: Video,
  camera: Camera,
  wheat: Wheat,
  shield: Shield,
  search: Search,
  settings: Settings,
}

interface Service {
  id: number
  name: string
  description: string
  price_per_hour: number
  icon: keyof typeof serviceIcons
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const [userName, setUserName] = useState("")

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
    fetchServices()
  }, [router])

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services")
      if (!response.ok) {
        throw new Error("Failed to fetch services")
      }
      const data = await response.json()
      setServices(data)
    } catch (error) {
      console.error("Failed to fetch services:", error)
      setError("Failed to load services. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleService = (serviceId: number) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    )
  }

  const handleContinue = () => {
    if (selectedServices.length > 0) {
      localStorage.setItem("selectedServices", JSON.stringify(selectedServices))
      router.push("/booking")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: "url(/images/services-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <Navigation userName={userName} showBackButton={false} />
      <div className="absolute inset-0 bg-black/30 z-0"></div>

      <div className="relative z-10 container mx-auto px-4 py-8 pt-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Drone Services</h1>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Select one or more professional drone services tailored to your needs
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <ErrorMessage message={error} onDismiss={() => setError("")} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {services.map((service) => {
            const IconComponent = serviceIcons[service.icon]
            const isSelected = selectedServices.includes(service.id)

            return (
              <Card
                key={service.id}
                className={`cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-xl ${
                  isSelected ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200" : "hover:shadow-lg border-gray-200"
                }`}
                onClick={() => toggleService(service.id)}
              >
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-4 relative">
                    <div className={`p-4 rounded-full ${isSelected ? "bg-blue-600" : "bg-gray-100"}`}>
                      <IconComponent className={`w-8 h-8 ${isSelected ? "text-white" : "text-gray-600"}`} />
                    </div>
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">{service.name}</CardTitle>
                  <CardDescription className="text-gray-600 min-h-[3rem]">{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary" className="text-lg font-semibold px-4 py-2">
                    ${service.price_per_hour}/hour
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {selectedServices.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
            <Card className="bg-white shadow-2xl border-0">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    {selectedServices.length} service{selectedServices.length > 1 ? "s" : ""} selected
                  </div>
                  <Button
                    onClick={handleContinue}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <span>Continue to Booking</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
