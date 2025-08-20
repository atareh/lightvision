"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react" // Added Arrow icons
import { formatDistance } from "date-fns"
import { useDebugSettings } from "@/hooks/use-debug-settings"

interface MetricsCardProps {
  title: string
  value: React.ReactNode
  change?: string // This will now be the pre-formatted string from formatPercentageChange or similar
  isPositive?: boolean
  isLoading?: boolean
  showIndicator?: boolean
  tooltip?: string
  onClick?: () => void
  active?: boolean
  color?: string
  updateFrequencyHours?: number
  lastUpdatedAt?: string | Date
  isRealtime?: boolean
  showChangeArrow?: boolean // New prop
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
  showChangeArrow = false, // Default to false
}: MetricsCardProps) {
  const { log } = useDebugSettings()
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
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-[#51d2c1]" />
            <span className="font-bold">Real-time data</span>
          </div>
          <div>Updates continuously</div>
        </div>
      )

    if (!lastUpdatedAt || !updateFrequencyHours) return ""
    try {
      const lastUpdate = new Date(lastUpdatedAt)
      const now = new Date()
      const frequencyText = `${updateFrequencyHours}H`
      const lastRefreshText = formatDistance(lastUpdate, now, { addSuffix: true })
      const nextUpdate = new Date(lastUpdate.getTime() + updateFrequencyHours * 60 * 60 * 1000)
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
        x: rect.right - 220,
        y: rect.bottom + 10,
      })
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const refreshText = getRefreshText()
  const refreshTooltip = getRefreshTooltip()

  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight

  return (
    <>
      <Card
        ref={cardRef}
        className={`w-full overflow-hidden transition-all duration-300 hover:shadow-lg relative ${
          active ? "before:absolute before:inset-0.5 before:rounded-lg before:border before:pointer-events-none ring-2 ring-offset-2 ring-offset-transparent" : ""
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
        {active && (
          <div
            className="absolute top-[18px] right-4 w-2 h-2 rounded-full z-10"
            style={{ backgroundColor: color }}
          ></div>
        )}
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-muted-foreground text-xs font-medium">
            <span className="block sm:hidden">
              {title === "Daily Revenue" ? "Daily Rev." : title === "Annualized Revenue" ? "Annualized Rev." : title}
            </span>
            <span className="hidden sm:block">{title}</span>
          </h3>
        </div>
        <CardContent className="px-4 py-2 pb-3 border-t border-border/20 flex flex-col justify-start space-y-2">
          {isLoading ? (
            <div className="flex flex-col justify-start space-y-2">
              <div className="animate-pulse h-7 bg-muted rounded w-24"></div>
              <div className="flex items-center h-4">
                <div className="animate-pulse h-3 bg-muted rounded w-16"></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-start space-y-2">
              {/* Debug logging for revenue metrics */}
              {(title.includes("Revenue") || title.includes("Daily")) &&
                log("showMetricsCardLogs", `MetricsCard Debug - ${title}:`, { value, change, isLoading, isPositive })}
              <p className="text-2xl font-bold text-foreground font-teodor tracking-tight">{value}</p>
              <div className="flex items-center h-4">
                {change && (
                  <span
                    className={`text-xs font-medium flex items-center gap-1 ${
                      isPositive ? "text-[#20a67d]" : "text-[#ed7188]"
                    }`}
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {showChangeArrow && <ChangeIcon className="h-3 w-3" />}
                    {(() => {
                      // Only remove "today" if this is NOT a wallet metric
                      const shouldKeepToday = title.toLowerCase().includes("wallet")
                      const cleanedChange = shouldKeepToday
                        ? change || ""
                        : change
                            ?.replace(/\s*today\s*/gi, " ")
                            .replace(/\s+/g, " ")
                            .trim() || ""

                      if (!isPositive && cleanedChange && !cleanedChange.startsWith("-")) {
                        return `-${cleanedChange}`
                      }
                      return cleanedChange
                    })()}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
        {(isRealtime || refreshText) && (
          <div
            className="absolute bottom-[18px] right-4 hidden sm:flex items-center gap-1 text-muted-foreground"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isRealtime ? (
              <Zap className="h-3 w-3 text-emerald-500" />
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-mono">{refreshText}</span>
              </>
            )}
          </div>
        )}
      </Card>
      {showTooltip && refreshTooltip && (
        <div
          className="fixed z-[9999] floating-card text-foreground text-xs shadow-xl pointer-events-none min-w-[200px] px-3 py-2"
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
