"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Eye, EyeOff, Play, Pause } from "lucide-react"
import { useRouter } from "next/navigation"
import { ErrorMessage } from "@/components/error-message"
import { LoadingSpinner } from "@/components/loading-spinner"
import { validateEmail } from "@/lib/validation"
import Image from "next/image"

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showVideo, setShowVideo] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    const userId = localStorage.getItem("userId")
    if (userId) {
      router.push("/services")
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Basic validation
    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    if (!formData.password) {
      setError("Password is required")
      setIsLoading(false)
      return
    }

    try {
      // Simulate login API call
      // In production, this would be a real authentication endpoint
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const user = await response.json()

        // Store user data
        localStorage.setItem("userId", user.id.toString())
        localStorage.setItem("userName", user.full_name)
        localStorage.setItem("userEmail", user.email)
        localStorage.setItem("userPhone", user.phone || "")

        router.push("/services")
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Login failed. Please check your credentials.")
      }
    } catch (error) {
      console.error("Login failed:", error)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    // Clear error when user starts typing
    if (error) setError("")
  }

  const toggleVideo = () => {
    setShowVideo(!showVideo)
    if (!showVideo) {
      setIsVideoPlaying(true)
    }
  }

  const handleVideoToggle = () => {
    const video = document.getElementById("hero-video") as HTMLVideoElement
    if (video) {
      if (isVideoPlaying) {
        video.pause()
        setIsVideoPlaying(false)
      } else {
        video.play()
        setIsVideoPlaying(true)
      }
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background - Video or Image */}
      <div className="absolute inset-0 z-0">
        {showVideo ? (
          <div className="relative w-full h-full">
            <video
              id="hero-video"
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setIsVideoPlaying(true)}
            >
              <source src="/videos/drone-hero-video.mp4" type="video/mp4" />
              <Image
                src="/images/drone-cinematic-hero.jpg"
                alt="Professional Drone in Action"
                fill
                className="object-cover"
                priority
                quality={90}
              />
            </video>
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70"></div>

            {/* Video Controls */}
            <div className="absolute bottom-4 right-4 z-10">
              <Button
                onClick={handleVideoToggle}
                variant="outline"
                size="sm"
                className="bg-black/50 border-white/30 text-white hover:bg-black/70"
              >
                {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <Image
              src="/images/drone-cinematic-hero.jpg"
              alt="Professional Drone in Action"
              fill
              className="object-cover"
              priority
              quality={90}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70"></div>
          </div>
        )}
      </div>

      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full shadow-2xl">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                    <path
                      d="M12 8L13.09 14.26L22 15L13.09 15.74L12 22L10.91 15.74L2 15L10.91 14.26L12 8Z"
                      opacity="0.6"
                    />
                  </svg>
                </div>
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full opacity-20 animate-pulse"></div>
              </div>
            </div>
            <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">SkyVision Pro</h1>
            <p className="text-xl text-gray-200 font-medium">Premium Drone Services</p>
            <p className="text-gray-300 mt-2">Professional aerial solutions for every need</p>

            {/* Video Toggle Button */}
            <div className="mt-4">
              <Button
                onClick={toggleVideo}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                {showVideo ? "Show Image" : "Watch Video"}
              </Button>
            </div>
          </div>

          <Card className="backdrop-blur-lg bg-white/95 shadow-2xl border-0 rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
              <CardDescription className="text-gray-600 text-base">
                Sign in to access your drone services
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {error && <ErrorMessage message={error} onDismiss={() => setError("")} className="mb-6" />}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="pl-11 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-base"
                      placeholder="Enter your email address"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="h-12 pr-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-base"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-blue-600 hover:text-blue-700 font-semibold"
                    onClick={() => router.push("/register")}
                  >
                    Create Account
                  </Button>
                </p>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">Demo: user@demo.com / password123</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
