"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"

interface MouseToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  clickPosition: { x: number; y: number } | null
}

export function MouseToast({ message, isVisible, onClose, clickPosition }: MouseToastProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Start fade-in animation
      setTimeout(() => setIsAnimating(true), 10)

      // Start fade-out after 1.2 seconds
      const fadeOutTimer = setTimeout(() => {
        setIsAnimating(false)
      }, 1200)

      // Remove from DOM after fade-out completes
      const removeTimer = setTimeout(() => {
        setShouldRender(false)
        onClose()
      }, 1500)

      return () => {
        clearTimeout(fadeOutTimer)
        clearTimeout(removeTimer)
      }
    } else {
      setIsAnimating(false)
      setShouldRender(false)
    }
  }, [isVisible, onClose])

  if (!shouldRender || !clickPosition) return null

  return (
    <div
      className="fixed z-50 pointer-events-none transition-all duration-300 ease-out"
      style={{
        left: clickPosition.x + 10,
        top: clickPosition.y - 5,
        transform: `scale(${isAnimating ? 1 : 0.8})`,
        opacity: isAnimating ? 1 : 0,
      }}
    >
      <div className="bg-[#51d2c1] text-black rounded-md px-2 py-1 shadow-lg flex items-center gap-1 text-xs font-medium">
        <Check className="w-3 h-3" />
        {message}
      </div>
    </div>
  )
}
