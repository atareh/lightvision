"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Zap } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

interface MetricsCardProps {
  title: string
  value: React.ReactNode
  change?: string
  isPositive?: boolean
  isLoading?: boolean
  showIndicator?: boolean
  tooltip?: string
  onClick?: () => void
  // Add these new props for refresh indicators
  updateFrequencyHours?: number
  lastUpdatedAt?: string | Date
  isRealtime?: boolean
}

export function MetricsCard({
  title,
  value,
  change,
  isPositive = true,
  isLoading = false,
  showIndicator = false,
  tooltip,
  onClick,
  updateFrequencyHours,
  lastUpdatedAt,
  isRealtime = false,
}: MetricsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const iconRef = useRef<HTMLDivElement>(null)

  const getRefreshText = () => {
    if (isRealtime) return null
    if (!updateFrequencyHours) return null

    if (updateFrequencyHours >= 24) {
      const days = Math.floor(updateFrequencyHours / 24)
      return `${days}D`
    }
    return `${updateFrequencyHours}H`
  }

  const getRefreshTooltip = () => {
    if (isRealtime) return "Real-time data"

    if (!lastUpdatedAt || !updateFrequencyHours) return ""

    try {
      const lastUpdate = new Date(lastUpdatedAt)
      // Calculate next refresh: last refresh time + update frequency
      const nextUpdate = new Date(lastUpdate.getTime() + updateFrequencyHours * 60 * 60 * 1000)
      const now = new Date()

      const lastRefreshedText = format(lastUpdate, "EEEE, MMM d 'at' h:mm a")

      // Calculate time until next refresh
      const timeUntilNext = nextUpdate > now ? formatDistanceToNow(nextUpdate, { addSuffix: false }) : "overdue"

      return (
        <div>
          <div>Last refresh was {lastRefreshedText}</div>
          <div>Next refresh is in {timeUntilNext}</div>
        </div>
      )
    } catch (error) {
      console.log("Tooltip error:", error, "lastUpdatedAt:", lastUpdatedAt)
      return ""
    }
  }

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setTooltipPosition({
        x: rect.right - 200, // Position tooltip to the right edge minus tooltip width
        y: rect.top - 10, // Position above the icon with some margin
      })
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const refreshText = getRefreshText()
  const refreshTooltip = getRefreshTooltip()

  return (
    <>
      <Card
        className={`w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] ${showIndicator ? "relative before:absolute before:inset-0.5 before:rounded-lg before:border border-[#20a67d] before:pointer-events-none" : ""} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
        title={tooltip}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-[#a0a8aa] text-xs font-medium flex items-center gap-2">
            {showIndicator && <div className="w-2 h-2 rounded-full bg-[#20a67d]"></div>}
            {title}
          </h3>
          {(isRealtime || refreshText) && (
            <div
              ref={iconRef}
              className="flex items-center gap-1 text-[#868d8f]"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {isRealtime ? (
                <>
                  <Zap className="h-3 w-3 text-[#51d2c1]" />
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] font-mono">{refreshText}</span>
                </>
              )}
            </div>
          )}
        </div>
        <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
          {isLoading ? (
            <div className="flex flex-col justify-start space-y-2">
              <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
              <div className="flex items-center h-4">
                <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-start space-y-2">
              <p className="text-2xl font-bold text-white font-teodor tracking-tight">{value}</p>
              <div className="flex items-center h-4">
                {change && (
                  <span
                    className={`text-xs font-medium flex items-center gap-1 ${
                      isPositive ? "text-[#20a67d]" : "text-[#ed7188]"
                    }`}
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {change}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tooltip rendered outside the card using fixed positioning */}
      {showTooltip && refreshTooltip && (
        <div
          className="fixed z-[9999] bg-[#1a2e2a] border border-[#2d5a4f] rounded px-3 py-2 text-xs text-white shadow-xl pointer-events-none min-w-[200px]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translateY(-100%)",
          }}
        >
          {refreshTooltip}
        </div>
      )}
    </>
  )
}
