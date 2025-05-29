"use client"

import { useEffect } from "react"
import { Check } from "lucide-react"

interface SimpleToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
}

export function SimpleToast({ message, isVisible, onClose }: SimpleToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-[#0f1a1f] border border-[#51d2c1] rounded-lg px-4 py-3 shadow-lg flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[#20a67d] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
        <span className="text-white text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}
