// Enhanced validation utilities with proper 24-hour advance booking
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ""))
}

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50
}

export const validateLocation = (location: string): boolean => {
  return location.trim().length >= 3 && location.trim().length <= 500
}

export const validateDate = (date: string, timeSlot: string): ValidationResult => {
  const errors: string[] = []

  if (!date) {
    errors.push("Date is required")
    return { isValid: false, errors }
  }

  if (!timeSlot) {
    errors.push("Time slot is required")
    return { isValid: false, errors }
  }

  try {
    // Parse the selected date and time
    const selectedDate = new Date(date)

    // Validate date format
    if (isNaN(selectedDate.getTime())) {
      errors.push("Invalid date format")
      return { isValid: false, errors }
    }

    const [time, period] = timeSlot.split(" ")
    if (!time || !period) {
      errors.push("Invalid time slot format")
      return { isValid: false, errors }
    }

    const [hours, minutes] = time.split(":").map(Number)
    if (isNaN(hours) || isNaN(minutes)) {
      errors.push("Invalid time format")
      return { isValid: false, errors }
    }

    let hour24 = hours
    if (period === "PM" && hours !== 12) {
      hour24 += 12
    } else if (period === "AM" && hours === 12) {
      hour24 = 0
    }

    selectedDate.setHours(hour24, minutes, 0, 0)

    // Current time
    const now = new Date()

    // Calculate 24 hours from now
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    if (selectedDate <= twentyFourHoursFromNow) {
      errors.push("Booking must be at least 24 hours in advance from current time")
    }

    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + 1)

    if (selectedDate > maxDate) {
      errors.push("Booking date cannot be more than 1 year in advance")
    }

    // Check if date is in the past
    if (selectedDate < now) {
      errors.push("Cannot book for past dates")
    }
  } catch (error) {
    errors.push("Invalid date or time format")
  }

  return { isValid: errors.length === 0, errors }
}

export const validateUserRegistration = (data: {
  fullName: string
  email: string
  phone: string
}): ValidationResult => {
  const errors: string[] = []

  if (!validateName(data.fullName)) {
    errors.push("Full name must be between 2 and 50 characters")
  }

  if (!validateEmail(data.email)) {
    errors.push("Please enter a valid email address")
  }

  if (!validatePhone(data.phone)) {
    errors.push("Please enter a valid phone number")
  }

  return { isValid: errors.length === 0, errors }
}

export const validateBooking = (data: {
  location: string
  date: string
  timeSlot: string
  duration: number
}): ValidationResult => {
  const errors: string[] = []

  if (!validateLocation(data.location)) {
    errors.push("Location must be between 3 and 500 characters")
  }

  const dateValidation = validateDate(data.date, data.timeSlot)
  if (!dateValidation.isValid) {
    errors.push(...dateValidation.errors)
  }

  if (!data.timeSlot) {
    errors.push("Time slot is required")
  }

  if (data.duration < 1 || data.duration > 8) {
    errors.push("Duration must be between 1 and 8 hours")
  }

  return { isValid: errors.length === 0, errors }
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "")
}

// Time utilities
export const formatTimeTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? "PM" : "AM"
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${hours12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`
}

export const formatTimeTo24Hour = (time12: string): string => {
  const [time, period] = time12.split(" ")
  const [hours, minutes] = time.split(":").map(Number)

  let hour24 = hours
  if (period === "PM" && hours !== 12) {
    hour24 += 12
  } else if (period === "AM" && hours === 12) {
    hour24 = 0
  }

  return `${hour24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

// Enhanced time slot disabling logic
export const isTimeSlotDisabled = (date: string, timeSlot: string): boolean => {
  if (!date || !timeSlot) return true

  try {
    const selectedDate = new Date(date)
    if (isNaN(selectedDate.getTime())) return true

    const [time, period] = timeSlot.split(" ")
    if (!time || !period) return true

    const [hours, minutes] = time.split(":").map(Number)
    if (isNaN(hours) || isNaN(minutes)) return true

    let hour24 = hours
    if (period === "PM" && hours !== 12) {
      hour24 += 12
    } else if (period === "AM" && hours === 12) {
      hour24 = 0
    }

    // Create the exact booking datetime
    const bookingDateTime = new Date(selectedDate)
    bookingDateTime.setHours(hour24, minutes, 0, 0)

    // Current time
    const now = new Date()

    // Calculate 24 hours from now
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Return true if the booking time is within 24 hours or in the past
    return bookingDateTime <= twentyFourHoursFromNow
  } catch (error) {
    console.error("Error checking time slot:", error)
    return true
  }
}

// Get available time slots for a specific date
export const getAvailableTimeSlots = (date: string) => {
  const timeSlots = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
    "06:00 PM",
  ]

  return timeSlots.map((timeSlot) => ({
    value: timeSlot,
    disabled: isTimeSlotDisabled(date, timeSlot),
    label: timeSlot,
  }))
}
