"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Zap } from "lucide-react"
import { formatDistance } from "date-fns"

interface MetricsCardProps {
  title: string
  value: React.ReactNode
  change?: string
  isPositive?: boolean
  isLoading?: boolean
  showIndicator?: boolean
  tooltip?: string
  onClick?: () => void
  active?: boolean // Add the active prop back
  color?: string // Add color prop for the active state
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
  active = false,
  color = "#20a67d",
  updateFrequencyHours,
  lastUpdatedAt,
  isRealtime = false,
}: MetricsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const getRefreshText = () => {
    if (isRealtime) return null
    if (!updateFrequencyHours) return null

    return `${updateFrequencyHours}H`
  }

  const getRefreshTooltip = () => {
    if (isRealtime)
      return (
        <div>
          <div className="font-bold mb-1">Real-time data</div>
          <div>Updates continuously</div>
        </div>
      )

    if (!lastUpdatedAt || !updateFrequencyHours) return ""

    try {
      const lastUpdate = new Date(lastUpdatedAt)
      const now = new Date()

      // Format for refresh frequency
      const frequencyText = `${updateFrequencyHours}H`

      // Format for last refresh - simplified to "about X ago"
      const lastRefreshText = formatDistance(lastUpdate, now, { addSuffix: true })

      // Calculate next refresh time
      const nextUpdate = new Date(lastUpdate.getTime() + updateFrequencyHours * 60 * 60 * 1000)

      // Format for next refresh - simplified
      const timeUntilNext =
        nextUpdate > now ? `in about ${formatDistance(now, nextUpdate, { addSuffix: false })}` : "overdue"

      return (
        <div>
          <div className="font-bold mb-1">Refreshes every {frequencyText}</div>
          <div>Last refresh was {lastRefreshText}</div>
          <div>Next refresh {timeUntilNext}</div>
        </div>
      )
    } catch (error) {
      console.log("Tooltip error:", error, "lastUpdatedAt:", lastUpdatedAt)
      return ""
    }
  }

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      setTooltipPosition({
        x: rect.right - 220, // Position tooltip at bottom right
        y: rect.bottom + 10, // Position below the card
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
        ref={cardRef}
        className={`w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] relative ${
          active ? "before:absolute before:inset-0.5 before:rounded-lg before:border before:pointer-events-none" : ""
        } ${onClick ? "cursor-pointer" : ""}`}
        style={
          active
            ? {
                borderColor: `${color}50`,
                "--tw-border-opacity": "0.3",
              }
            : {}
        }
        onClick={onClick}
        title={tooltip}
      >
        {/* Active dot positioned absolutely in line with title */}
        {active && (
          <div
            className="absolute top-[18px] right-4 w-2 h-2 rounded-full z-10"
            style={{ backgroundColor: color }}
          ></div>
        )}

        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-[#a0a8aa] text-xs font-medium">
            <span className="block sm:hidden">
              {title === "Daily Revenue" ? "Daily Rev." : title === "Annualized Revenue" ? "Annualized Rev." : title}
            </span>
            <span className="hidden sm:block">{title}</span>
          </h3>
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
        {/* Clock/refresh indicator positioned aligned with subtext with padding */}
        {(isRealtime || refreshText) && (
          <div
            className="absolute bottom-[18px] right-4 flex items-center gap-1 text-[#868d8f]"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isRealtime ? (
              <Zap className="h-3 w-3 text-[#51d2c1]" />
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-mono">{refreshText}</span>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Tooltip rendered outside the card using fixed positioning */}
      {showTooltip && refreshTooltip && (
        <div
          className="fixed z-[9999] bg-[#1a2e2a] border border-[#2d5a4f] rounded px-3 py-2 text-xs text-white shadow-xl pointer-events-none min-w-[200px]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
        >
          {refreshTooltip}
        </div>
      )}
    </>
  )
}
