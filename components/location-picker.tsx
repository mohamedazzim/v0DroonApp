"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Navigation, Loader2, AlertCircle } from "lucide-react"

interface LocationPickerProps {
  value: string
  onChange: (location: string, coordinates?: { lat: number; lng: number }) => void
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export function LocationPicker({ value, onChange, placeholder = "Enter location", className }: LocationPickerProps) {
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [mapError, setMapError] = useState("")
  const [isScriptLoading, setIsScriptLoading] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadGoogleMapsScript()
  }, [])

  const loadGoogleMapsScript = () => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsMapLoaded(true)
      return
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]') || isScriptLoading) {
      setIsScriptLoading(true)
      // Wait for it to load
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsMapLoaded(true)
          setIsScriptLoading(false)
          clearInterval(checkGoogleMaps)
        }
      }, 100)

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!window.google || !window.google.maps) {
          setMapError("Failed to load Google Maps. Please refresh the page.")
          setIsScriptLoading(false)
          clearInterval(checkGoogleMaps)
        }
      }, 10000)
      return
    }

    setIsScriptLoading(true)
    const script = document.createElement("script")
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBFw0Qbyq9zTFTd-tUY6dO_BcqzKOqiOx0"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
    script.async = true
    script.defer = true

    // Add global callback
    window.initGoogleMaps = () => {
      setIsMapLoaded(true)
      setIsScriptLoading(false)
    }

    script.onerror = () => {
      setMapError("Failed to load Google Maps. Please check your internet connection.")
      setIsScriptLoading(false)
    }

    document.head.appendChild(script)
  }

  useEffect(() => {
    if (isMapLoaded && inputRef.current && !autocompleteRef.current) {
      initializeAutocomplete()
    }
  }, [isMapLoaded])

  const initializeAutocomplete = () => {
    if (!window.google || !inputRef.current) return

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
        fields: ["place_id", "geometry", "name", "formatted_address"],
      })

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace()
        if (place.geometry && place.geometry.location) {
          const location = place.formatted_address || place.name
          const coordinates = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }
          setSelectedCoordinates(coordinates)
          onChange(location, coordinates)
          if (showMap) {
            updateMap(coordinates)
          }
        }
      })
    } catch (error) {
      console.error("Error initializing autocomplete:", error)
      setMapError("Error initializing location search")
    }
  }

  const initializeMap = () => {
    if (!window.google || !mapRef.current) return

    try {
      const defaultLocation = selectedCoordinates || { lat: 40.7128, lng: -74.006 } // Default to NYC

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: defaultLocation,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      markerInstance.current = new window.google.maps.Marker({
        position: defaultLocation,
        map: mapInstance.current,
        draggable: true,
        title: "Service Location",
      })

      // Add click listener to map
      mapInstance.current.addListener("click", (event: any) => {
        const coordinates = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        }
        updateMarker(coordinates)
        reverseGeocode(coordinates)
      })

      // Add drag listener to marker
      markerInstance.current.addListener("dragend", (event: any) => {
        const coordinates = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        }
        reverseGeocode(coordinates)
      })
    } catch (error) {
      console.error("Error initializing map:", error)
      setMapError("Error loading map")
    }
  }

  const updateMap = (coordinates: { lat: number; lng: number }) => {
    if (mapInstance.current && markerInstance.current) {
      mapInstance.current.setCenter(coordinates)
      markerInstance.current.setPosition(coordinates)
    }
  }

  const updateMarker = (coordinates: { lat: number; lng: number }) => {
    if (markerInstance.current) {
      markerInstance.current.setPosition(coordinates)
    }
    setSelectedCoordinates(coordinates)
  }

  const reverseGeocode = (coordinates: { lat: number; lng: number }) => {
    if (!window.google) return

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: coordinates }, (results: any, status: any) => {
      if (status === "OK" && results[0]) {
        const address = results[0].formatted_address
        onChange(address, coordinates)
        if (inputRef.current) {
          inputRef.current.value = address
        }
      }
    })
  }

  const toggleMap = () => {
    if (!isMapLoaded) {
      if (isScriptLoading) {
        setMapError("Google Maps is still loading. Please wait a moment.")
      } else {
        setMapError("Google Maps failed to load. Please refresh the page.")
      }
      return
    }

    setShowMap(!showMap)
    if (!showMap && isMapLoaded) {
      setTimeout(() => {
        initializeMap()
      }, 100)
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError("Geolocation is not supported by this browser.")
      return
    }

    setIsLoadingLocation(true)
    setMapError("")

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setSelectedCoordinates(coordinates)

        // If Google Maps is loaded, use reverse geocoding
        if (window.google && window.google.maps) {
          reverseGeocode(coordinates)
        } else {
          // Fallback: set coordinates and a generic location string
          const locationString = `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`
          onChange(locationString, coordinates)
          if (inputRef.current) {
            inputRef.current.value = locationString
          }
        }

        if (showMap) {
          updateMap(coordinates)
        }
        setIsLoadingLocation(false)
      },
      (error) => {
        console.error("Geolocation error:", error)
        let errorMessage = "Unable to get your current location."

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable."
            break
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again."
            break
          default:
            errorMessage = "An unknown error occurred while retrieving location."
            break
        }

        setMapError(errorMessage)
        setIsLoadingLocation(false)
      },
      options,
    )
  }

  const clearError = () => {
    setMapError("")
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            className="pl-10 h-12"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>

        {mapError && (
          <div className="flex items-start space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p>{mapError}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="p-1 h-auto text-red-600 hover:text-red-800"
            >
              ×
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleMap}
            disabled={!isMapLoaded && !isScriptLoading}
            className="flex items-center space-x-2 bg-transparent"
          >
            <MapPin className="w-4 h-4" />
            <span>{showMap ? "Hide Map" : "Show Map"}</span>
            {isScriptLoading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            disabled={isLoadingLocation}
            className="flex items-center space-x-2 bg-transparent"
          >
            {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            <span>Current Location</span>
          </Button>
        </div>

        {showMap && isMapLoaded && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div ref={mapRef} className="w-full h-64" style={{ minHeight: "256px" }} />
              <div className="p-3 bg-gray-50 text-sm text-gray-600">
                Click on the map or drag the marker to select exact location
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
