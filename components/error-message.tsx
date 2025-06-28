"use client"

import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  message: string
  onDismiss?: () => void
  className?: string
}

export function ErrorMessage({ message, onDismiss, className }: ErrorMessageProps) {
  return (
    <div className={cn("bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3", className)}>
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-800">{message}</p>
      </div>
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss} className="p-1 h-auto text-red-600 hover:text-red-800">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
