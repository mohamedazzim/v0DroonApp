"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { MapPin, Battery, Signal, Gauge, MountainIcon as Altitude } from "lucide-react"
import { useWebSocket } from "@/hooks/use-websocket"

interface TrackingData {
  id: number
  booking_id: number
  operator_id: number
  latitude: number
  longitude: number
  altitude?: number
  speed?: number
  battery_level?: number
  signal_strength?: number
  status: "preparing" | "takeoff" | "flying" | "recording" | "returning" | "landed"
  timestamp: string
}

interface LiveTrackingProps {
  bookingId: number
  isOperator?: boolean
}

export function LiveTracking({ bookingId, isOperator = false }: LiveTrackingProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any | null>(null)
  const markerRef = useRef<any | null>(null)
  const pathRef = useRef<any | null>(null)
  const pathCoordinates = useRef<any[]>([])

  const { isConnected, lastMessage, updateLocation, joinBooking } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      joinBooking(bookingId)
    },
  })

  function handleWebSocketMessage(message: any) {
    switch (message.type) {
      case "current_tracking":
        if (message.booking_id === bookingId && message.tracking) {
          setTrackingData(message.tracking)
          updateMapLocation(message.tracking)
        }
        break

      case "location_update":
        if (message.booking_id === bookingId) {
          const newTrackingData = {
            id: 0,
            booking_id: message.booking_id,
            operator_id: message.operator_id,
            latitude: message.latitude,
            longitude: message.longitude,
            altitude: message.altitude,
            speed: message.speed,
            battery_level: message.battery_level,
            signal_strength: message.signal_strength,
            status: message.status,
            timestamp: message.timestamp,
          }
          setTrackingData(newTrackingData)
          updateMapLocation(newTrackingData)
        }
        break
    }
  }

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      zoom: 15,
      center: { lat: 28.6139, lng: 77.209 }, // Default to Delhi
      mapTypeId: window.google.maps.MapTypeId.HYBRID,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    })

    // Initialize marker
    markerRef.current = new window.google.maps.Marker({
      map: mapInstance.current,
      icon: {
        url: "/icons/drone-marker.png",
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 20),
      },
      title: "Drone Location",
    })

    // Initialize path
    pathRef.current = new window.google.maps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: "#667eea",
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map: mapInstance.current,
    })
  }

  const updateMapLocation = (data: TrackingData) => {
    if (!mapInstance.current || !markerRef.current || !pathRef.current) return

    const position = new window.google.maps.LatLng(data.latitude, data.longitude)

    // Update marker position
    markerRef.current.setPosition(position)

    // Add to path
    pathCoordinates.current.push(position)
    pathRef.current.setPath(pathCoordinates.current)

    // Center map on new position
    mapInstance.current.setCenter(position)

    // Update marker icon based on status
    const iconUrl = getStatusIcon(data.status)
    markerRef.current.setIcon({
      url: iconUrl,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 20),
    })
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      preparing: "/icons/drone-preparing.png",
      takeoff: "/icons/drone-takeoff.png",
      flying: "/icons/drone-flying.png",
      recording: "/icons/drone-recording.png",
      returning: "/icons/drone-returning.png",
      landed: "/icons/drone-landed.png",
    }
    return icons[status as keyof typeof icons] || "/icons/drone-marker.png"
  }

  const getStatusColor = (status: string) => {
    const colors = {
      preparing: "bg-yellow-500",
      takeoff: "bg-blue-500",
      flying: "bg-green-500",
      recording: "bg-red-500",
      returning: "bg-orange-500",
      landed: "bg-gray-500",
    }
    return colors[status as keyof typeof colors] || "bg-gray-500"
  }

  const getStatusText = (status: string) => {
    const texts = {
      preparing: "Preparing for Flight",
      takeoff: "Taking Off",
      flying: "In Flight",
      recording: "Recording",
      returning: "Returning to Base",
      landed: "Landed",
    }
    return texts[status as keyof typeof texts] || status
  }

  const startLocationTracking = () => {
    if (!navigator.geolocation || !isOperator) return

    setIsTracking(true)

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          speed: position.coords.speed || 0,
          battery_level: 85, // This would come from drone telemetry
          signal_strength: 95, // This would come from drone telemetry
          status: "flying" as const,
        }

        updateLocation(bookingId, locationData)
      },
      (error) => {
        console.error("Geolocation error:", error)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      setIsTracking(false)
    }
  }

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`
      script.onload = initializeMap
      document.head.appendChild(script)
    } else {
      initializeMap()
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Tracking</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-muted-foreground">{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trackingData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin />
                <span>
                  {trackingData.latitude}, {trackingData.longitude}
                </span>
              </div>
              {trackingData.altitude !== undefined && (
                <div className="flex items-center gap-2">
                  <Altitude />
                  <span>{trackingData.altitude}m</span>
                </div>
              )}
              {trackingData.speed !== undefined && (
                <div className="flex items-center gap-2">
                  <Gauge />
                  <span>{trackingData.speed}km/h</span>
                </div>
              )}
              {trackingData.battery_level !== undefined && (
                <div className="flex items-center gap-2">
                  <Battery />
                  <Progress value={trackingData.battery_level} />
                </div>
              )}
              {trackingData.signal_strength !== undefined && (
                <div className="flex items-center gap-2">
                  <Signal />
                  <Progress value={trackingData.signal_strength} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(trackingData.status)}>{getStatusText(trackingData.status)}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Map */}
      <div ref={mapRef} style={{ height: "400px", width: "100%" }} />
    </div>
  )
}
