"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Smartphone, Download } from "lucide-react"

export function MobileAppBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    // Check if user is on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Check if app is already installed (PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches

    // Check if banner was dismissed
    const wasDismissed = localStorage.getItem("mobile-app-banner-dismissed")

    if (isMobile && !isStandalone && !wasDismissed) {
      setIsVisible(true)
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
      setIsAndroid(/Android/.test(navigator.userAgent))
    }
  }, [])

  const dismissBanner = () => {
    setIsVisible(false)
    localStorage.setItem("mobile-app-banner-dismissed", "true")
  }

  const installPWA = () => {
    // This would trigger PWA installation
    if ("serviceWorker" in navigator) {
      // PWA installation logic
      console.log("Installing PWA...")
    }
  }

  if (!isVisible) return null

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg md:hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-sm">Get our mobile app</h3>
            <p className="text-xs text-muted-foreground">
              Better experience with offline access and push notifications
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={installPWA}>
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
            <Button variant="ghost" size="sm" onClick={dismissBanner}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
