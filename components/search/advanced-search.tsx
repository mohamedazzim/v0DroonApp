"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Search, Filter, X, MapPin, Calendar, DollarSign } from "lucide-react"
import { addDays } from "date-fns"

interface SearchFilters {
  query: string
  service_type: string
  status: string
  date_range: {
    from: Date
    to: Date
  }
  price_range: [number, number]
  location: string
  rating: number
  sort_by: string
  sort_order: "asc" | "desc"
}

interface SearchResult {
  id: number
  type: "booking" | "service" | "customer"
  title: string
  description: string
  metadata: any
  relevance_score: number
}

export function AdvancedSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    service_type: "all_services",
    status: "all_statuses",
    date_range: {
      from: addDays(new Date(), -30),
      to: new Date(),
    },
    price_range: [0, 50000],
    location: "",
    rating: 0,
    sort_by: "relevance",
    sort_order: "desc",
  })

  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [savedSearches, setSavedSearches] = useState<any[]>([])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (filters.query.length >= 3) {
        performSearch()
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [filters])

  const performSearch = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("session_token")

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(filters),
      })

      const data = await response.json()
      if (data.success) {
        setResults(data.results)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSearch = async () => {
    try {
      const token = localStorage.getItem("session_token")
      const searchName = prompt("Enter a name for this search:")

      if (!searchName) return

      await fetch("/api/search/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: searchName,
          filters: filters,
        }),
      })

      loadSavedSearches()
    } catch (error) {
      console.error("Failed to save search:", error)
    }
  }

  const loadSavedSearches = async () => {
    try {
      const token = localStorage.getItem("session_token")
      const response = await fetch("/api/search/saved", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (data.success) {
        setSavedSearches(data.searches)
      }
    } catch (error) {
      console.error("Failed to load saved searches:", error)
    }
  }

  const loadSavedSearch = (search: any) => {
    setFilters(search.filters)
  }

  const clearFilters = () => {
    setFilters({
      query: "",
      service_type: "all_services",
      status: "all_statuses",
      date_range: {
        from: addDays(new Date(), -30),
        to: new Date(),
      },
      price_range: [0, 50000],
      location: "",
      rating: 0,
      sort_by: "relevance",
      sort_order: "desc",
    })
    setResults([])
  }

  const getResultIcon = (type: string) => {
    const icons = {
      booking: Calendar,
      service: MapPin,
      customer: DollarSign,
    }
    const Icon = icons[type as keyof typeof icons] || Search
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search bookings, services, customers..."
                value={filters.query}
                onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button onClick={saveSearch} disabled={!filters.query}>
              Save Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Advanced Filters</span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Service Type</label>
                <Select
                  value={filters.service_type}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, service_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_services">All Services</SelectItem>
                    <SelectItem value="aerial_photography">Aerial Photography</SelectItem>
                    <SelectItem value="videography">Videography</SelectItem>
                    <SelectItem value="mapping">Mapping & Surveying</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_statuses">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Location</label>
                <Input
                  placeholder="Enter city or area"
                  value={filters.location}
                  onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <DatePickerWithRange
                  date={filters.date_range}
                  onDateChange={(range) => setFilters((prev) => ({ ...prev, date_range: range }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Price Range: ₹{filters.price_range[0]} - ₹{filters.price_range[1]}
                </label>
                <Slider
                  value={filters.price_range}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, price_range: value as [number, number] }))}
                  max={100000}
                  step={1000}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select
                  value={filters.sort_by}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, sort_by: value }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Order</label>
                <Select
                  value={filters.sort_order}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, sort_order: value as "asc" | "desc" }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((search) => (
                <Badge
                  key={search.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => loadSavedSearch(search)}
                >
                  {search.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {(isLoading || results.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results {results.length > 0 && `(${results.length})`}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <div key={result.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getResultIcon(result.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{result.title}</h3>
                          <Badge variant="outline">{result.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(result.relevance_score * 100)}% match
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{result.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
