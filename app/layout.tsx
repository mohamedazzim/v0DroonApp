import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: "SkyVision Pro - Premium Drone Services",
  description:
    "Professional drone services for videography, photography, agriculture, surveillance, and inspection. Book your aerial solutions today.",
  keywords:
    "drone services, aerial photography, videography, agriculture, surveillance, inspection, professional drones",
  authors: [{ name: "SkyVision Pro", url: "https://skyvisionpro.com" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  robots: "index, follow",
  openGraph: {
    title: "SkyVision Pro - Premium Drone Services",
    description: "Professional drone services for all your aerial needs",
    type: "website",
    locale: "en_US",
    siteName: "SkyVision Pro",
    images: [
      {
        url: "/images/drone-cinematic-hero.jpg",
        width: 1200,
        height: 630,
        alt: "SkyVision Pro - Professional Drone Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SkyVision Pro - Premium Drone Services",
    description: "Professional drone services for all your aerial needs",
    images: ["/images/drone-cinematic-hero.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">{children}</div>
        </ErrorBoundary>
      </body>
    </html>
  )
}
