"use client"

import { useState } from "react"
import Image from "next/image"

interface ImageFallbackProps {
  src: string
  alt: string
  fallbackSrc?: string
  className?: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
}

export function ImageFallback({
  src,
  alt,
  fallbackSrc = "/placeholder.svg?height=400&width=400",
  className,
  ...props
}: ImageFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(fallbackSrc)
    }
  }

  return <Image src={imgSrc || "/placeholder.svg"} alt={alt} className={className} onError={handleError} {...props} />
}
