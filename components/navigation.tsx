"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, User, Calendar, LogOut, Menu, X } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"

interface NavigationProps {
  showBackButton?: boolean
  userName?: string
}

export function Navigation({ showBackButton = true, userName }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userPhone")
    localStorage.removeItem("selectedServices")
    localStorage.removeItem("pendingBooking")
    localStorage.removeItem("paymentResult")
    router.push("/")
  }

  const handleBack = () => {
    router.back()
  }

  const navigateToBookings = () => {
    router.push("/bookings")
    setIsMobileMenuOpen(false)
  }

  const navigateToServices = () => {
    router.push("/services")
    setIsMobileMenuOpen(false)
  }

  // Don't show navigation on login/register pages
  if (pathname === "/" || pathname === "/register") return null

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Back button */}
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="font-bold text-xl text-gray-900">SkyVision Pro</div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" onClick={navigateToServices} className="text-gray-700 hover:text-blue-600">
              Services
            </Button>
            <Button variant="ghost" onClick={navigateToBookings} className="text-gray-700 hover:text-blue-600">
              My Bookings
            </Button>

            {userName && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 text-gray-700 hover:text-blue-600">
                    <User className="w-4 h-4" />
                    <span>{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={navigateToBookings} className="cursor-pointer">
                    <Calendar className="w-4 h-4 mr-2" />
                    My Bookings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
            <Button variant="ghost" onClick={navigateToServices} className="w-full justify-start text-gray-700">
              Services
            </Button>
            <Button variant="ghost" onClick={navigateToBookings} className="w-full justify-start text-gray-700">
              <Calendar className="w-4 h-4 mr-2" />
              My Bookings
            </Button>
            {userName && (
              <>
                <div className="px-3 py-2 text-sm text-gray-500 border-t">Signed in as {userName}</div>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
