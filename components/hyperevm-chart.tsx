"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"

export default function HyperEVMChart() {
  const { data: hyperEVMData, loading: hyperEVMLoading } = useHyperEVMData()
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null, date: "" })
  const [protocolColors, setProtocolColors] = useState({})
  const chartContainerRef = useRef(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 })
  const [timeRange, setTimeRange] = useState("7D") // Default to 7 days
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 400 : false)

  // Use real historical data from API
  const chartData = useMemo(() => {
    if (!hyperEVMData?.historical_data) return []

    // Filter data based on selected time range
    const now = new Date()
    let daysToShow = 7
    if (timeRange === "30D") daysToShow = 30
    if (timeRange === "90D") daysToShow = 90
    if (timeRange === "MAX") daysToShow = hyperEVMData.historical_data.length

    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow + 1) // Add +1 to include today

    return hyperEVMData.historical_data.filter((day) => {
      const dayDate = new Date(day.date)
      return dayDate >= cutoffDate
    })
  }, [hyperEVMData, timeRange])

  // Generate colors for protocols
  useEffect(() => {
    if (!hyperEVMData?.historical_data) return

    // Get all protocols from the entire dataset, not just filtered chartData
    const allProtocols = new Set()
    hyperEVMData.historical_data.forEach((day) => {
      Object.keys(day.protocols || {}).forEach((protocol) => {
        allProtocols.add(protocol)
      })
    })

    // Sort protocols alphabetically to ensure consistent color assignment
    const sortedProtocols = Array.from(allProtocols).sort()

    const colors = {}
    const colorPalette = [
      "#3b82f6", // Blue
      "#ef4444", // Red
      "#10b981", // Emerald
      "#f59e0b", // Amber
      "#8b5cf6", // Violet
      "#06b6d4", // Cyan
      "#f97316", // Orange
      "#84cc16", // Lime
      "#ec4899", // Pink
      "#6366f1", // Indigo
      "#14b8a6", // Teal
      "#eab308", // Yellow
      "#dc2626", // Red-600
      "#059669", // Emerald-600
      "#7c3aed", // Violet-600
      "#f43f5e", // Rose
      "#06b6d4", // Cyan-500
      "#8b5cf6", // Violet-500
      "#f97316", // Orange-500
      "#22c55e", // Green-500
    ]

    sortedProtocols.forEach((protocol, index) => {
      colors[protocol] = colorPalette[index % colorPalette.length]
    })

    setProtocolColors(colors)
  }, [hyperEVMData])

  // Update chart dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect()
        setChartDimensions({ width, height })
      }
    }

    if (chartContainerRef.current) {
      updateDimensions()
    }

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        updateDimensions()
      }
    })

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current)
    }

    return () => {
      if (chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [chartContainerRef.current])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 400)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Format value for display
  const formatValue = (value, isYAxis = false) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`
    } else if (value >= 10e6) {
      return `$${(value / 1e6).toFixed(1)}M`
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return isYAxis ? `$${Math.round(value / 1e3)}K` : `$${(value / 1e3).toFixed(1)}K`
    }
    return `$${Math.round(value)}`
  }

  // Format date for tooltip
  const formatDateTooltip = (dateStr) => {
    const date = new Date(`${dateStr}T00:00:00`)
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  }

  // Format date for X-axis
  const formatDateAxis = (dateStr) => {
    const date = new Date(`${dateStr}T00:00:00`)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Calculate stacked chart data
  const calculatedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0 || chartDimensions.width === 0) {
      return {
        stackedData: [],
        protocols: [],
        maxValue: 0,
        width: 1000,
        height: 600,
        padding: { top: 12, right: 20, bottom: 30, left: 50 },
        isNarrow: false,
      }
    }

    // Get all unique protocols across all days
    const allProtocols = new Set()
    chartData.forEach((day) => {
      Object.keys(day.protocols || {}).forEach((protocol) => {
        allProtocols.add(protocol)
      })
    })

    // Get latest day's data to sort protocols by value
    const latestDay = chartData[chartData.length - 1]
    const protocols = Array.from(allProtocols).sort((a, b) => {
      const valueA = latestDay?.protocols?.[a] || 0
      const valueB = latestDay?.protocols?.[b] || 0
      return valueA - valueB // Sort ascending so smallest are at bottom
    })

    const maxValue = Math.max(...chartData.map((d) => d.total))

    // Use fixed chart dimensions
    // const CHART_WIDTH = 1000
    // const CHART_HEIGHT = 400

    // Responsive adjustments based on actual container width
    const isNarrow = chartDimensions.width < 600
    const isMobile = typeof window !== "undefined" ? window.innerWidth < 400 : false

    const padding = {
      top: 40, // px above the first pixel of data
      bottom: 50, // px below the bottom axis (so "$0" never gets cut)
      left: 60, // px from the left edge for your Y-axis labels
      right: 20, // px from the right edge (you've already slimmed your legend to w-36)
    }

    // Create stacked data points using fixed dimensions
    const stackedData = chartData.map((dayData, dayIndex) => {
      const x =
        padding.left + (dayIndex / (chartData.length - 1)) * (chartDimensions.width - padding.left - padding.right)
      let cumulativeY = chartDimensions.height - padding.bottom

      const dayPoints = protocols.map((protocol) => {
        const value = dayData.protocols[protocol] || 0
        const height = (value / maxValue) * (chartDimensions.height - padding.top - padding.bottom)
        const y = cumulativeY - height

        const point = {
          protocol,
          x,
          y,
          height,
          value,
          date: dayData.date,
          dayIndex,
        }

        cumulativeY = y
        return point
      })

      return {
        date: dayData.date,
        total: dayData.total,
        x,
        points: dayPoints,
      }
    })

    return {
      stackedData,
      protocols,
      maxValue,
      width: chartDimensions.width,
      height: chartDimensions.height,
      padding,
      isNarrow,
    }
  }, [chartData, chartDimensions.width, chartDimensions.height])

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    if (!calculatedChartData || calculatedChartData.width === 0) return []

    const { maxValue, height, padding, isNarrow } = calculatedChartData
    const steps = isNarrow ? 3 : 4
    const stepSize = maxValue / steps

    const labels = []
    for (let i = 0; i <= steps; i++) {
      const value = stepSize * i
      const y = height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom)

      labels.push({
        value,
        y,
        label: formatValue(value, true),
      })
    }

    return labels
  }, [calculatedChartData])

  const handleMouseMove = (e) => {
    // Disable hover interactions on mobile
    if (isMobile) {
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    // Convert mouse position to viewBox coordinates
    const scaledMouseX = (mouseX / rect.width) * chartDimensions.width
    const scaledMouseY = (mouseY / rect.height) * chartDimensions.height

    // Find closest day
    if (
      scaledMouseX < calculatedChartData.padding.left ||
      scaledMouseX > chartDimensions.width - calculatedChartData.padding.right
    ) {
      setTooltip({ ...tooltip, show: false })
      setHoveredPoint(null)
      return
    }

    const dataX = scaledMouseX - calculatedChartData.padding.left
    const chartWidth = chartDimensions.width - calculatedChartData.padding.left - calculatedChartData.padding.right
    const dayIndex = Math.round((dataX / chartWidth) * (calculatedChartData.stackedData.length - 1))
    const clampedIndex = Math.max(0, Math.min(calculatedChartData.stackedData.length - 1, dayIndex))

    if (calculatedChartData.stackedData[clampedIndex]) {
      const dayData = calculatedChartData.stackedData[clampedIndex]
      setTooltip({
        show: true,
        x: dayData.x,
        y: scaledMouseY,
        data: dayData,
        date: dayData.date,
      })
      setHoveredPoint(clampedIndex)
    }
  }

  // Get latest protocol data for legend
  const latestProtocolData = useMemo(() => {
    if (!chartData || chartData.length === 0) return []

    const latest = chartData[chartData.length - 1]
    if (!latest) return []

    return Object.entries(latest.protocols || {})
      .map(([protocol, value]) => ({ protocol, value }))
      .sort((a, b) => b.value - a.value)
  }, [chartData])

  if (hyperEVMLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading chart...</span>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <span className="text-gray-400 text-sm">No historical data available</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Title and Time Range Controls */}
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-[#868d8f] text-sm font-medium font-sans">HyperEVM TVL</h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${timeRange === "7D" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-[#2d5a4f]"} rounded-md`}
            onClick={() => setTimeRange("7D")}
          >
            7D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${timeRange === "30D" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-[#2d5a4f]"} rounded-md`}
            onClick={() => setTimeRange("30D")}
          >
            30D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${timeRange === "90D" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-[#2d5a4f]"} rounded-md`}
            onClick={() => setTimeRange("90D")}
          >
            90D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${timeRange === "MAX" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-[#2d5a4f]"} rounded-md`}
            onClick={() => setTimeRange("MAX")}
          >
            MAX
          </Button>
        </div>
      </div>
      {/* Chart container – now fills all available height */}
      <div className="w-full flex-1 flex flex-row">
        {/* Chart Area */}
        <div className="flex-1 relative h-full" ref={chartContainerRef}>
          {chartDimensions.width > 0 && chartDimensions.height > 0 ? (
            <svg
              width={chartDimensions.width}
              height={chartDimensions.height}
              viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
              className={`absolute top-0 left-0 w-full h-full ${isMobile ? "" : "cursor-crosshair"}`}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                setTooltip({ ...tooltip, show: false })
                setHoveredPoint(null)
              }}
            >
              <defs>
                {/* Gradients for each protocol */}
                {calculatedChartData.protocols.map((protocol) => (
                  <linearGradient key={protocol} id={`gradient-${protocol}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={protocolColors[protocol]} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={protocolColors[protocol]} stopOpacity="0.4" />
                  </linearGradient>
                ))}
              </defs>

              {/* Watermark - Center */}
              <text
                x={chartDimensions.width / 2}
                y={chartDimensions.height * 0.2}
                textAnchor="middle"
                className="fill-white"
                style={{
                  fontSize: "24px",
                  fontWeight: "normal",
                  opacity: "0.03",
                  fontFamily: "Teodor, Arial, sans-serif",
                  pointerEvents: "none",
                }}
              >
                <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>Hype</tspan>
                <tspan style={{ fontStyle: "italic", fontWeight: "300" }}>Screener</tspan>
                <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>.xyz</tspan>
              </text>

              {/* Remove the top-left watermark */}

              {calculatedChartData.width > 0 && (
                <>
                  {/* Y-axis */}
                  <line
                    x1={calculatedChartData.padding.left}
                    y1={calculatedChartData.padding.top}
                    x2={calculatedChartData.padding.left}
                    y2={calculatedChartData.height - calculatedChartData.padding.bottom}
                    stroke="#2d5a4f"
                    strokeWidth="1"
                  />

                  {/* X-axis */}
                  <line
                    x1={calculatedChartData.padding.left}
                    y1={calculatedChartData.height - calculatedChartData.padding.bottom}
                    x2={calculatedChartData.width - calculatedChartData.padding.right}
                    y2={calculatedChartData.height - calculatedChartData.padding.bottom}
                    stroke="#2d5a4f"
                    strokeWidth="1"
                  />

                  {/* Y-axis labels */}
                  {yAxisLabels.map((label, i) => (
                    <g key={i}>
                      <line
                        x1={calculatedChartData.padding.left}
                        y1={label.y}
                        x2={calculatedChartData.width - calculatedChartData.padding.right}
                        y2={label.y}
                        stroke="#2d5a4f"
                        strokeWidth="0.5"
                        opacity="0.3"
                      />
                      <text
                        x={calculatedChartData.padding.left - 10}
                        y={label.y + 4}
                        textAnchor="end"
                        className="fill-[#868d8f]"
                        style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {label.label}
                      </text>
                    </g>
                  ))}

                  {/* X-axis labels */}
                  {calculatedChartData.stackedData.map((dayData, i) => {
                    // Dynamic label frequency based on data length and screen size
                    let showEvery = 1
                    if (isMobile) {
                      // More aggressive reduction for mobile screens, but keep 7D as is
                      if (calculatedChartData.stackedData.length > 30)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 4) // MAX/90D view on mobile
                      else if (calculatedChartData.stackedData.length > 7)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 3) // 30D view on mobile
                      // Remove the 7D mobile override - let it use default showEvery = 1
                    } else if (calculatedChartData.isNarrow) {
                      // Tablet/narrow screens
                      if (calculatedChartData.stackedData.length > 90)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 8) // MAX view
                      else if (calculatedChartData.stackedData.length > 30)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 6) // 90D view
                      else if (calculatedChartData.stackedData.length > 7)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 4) // 30D view
                      else showEvery = 2 // 7D narrow screens
                    } else {
                      // Desktop
                      if (calculatedChartData.stackedData.length > 90)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 10) // MAX view
                      else if (calculatedChartData.stackedData.length > 30)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 8) // 90D view
                      else if (calculatedChartData.stackedData.length > 7)
                        showEvery = Math.ceil(calculatedChartData.stackedData.length / 6) // 30D view
                    }

                    // Always show first and last point, skip others based on showEvery
                    if (i !== 0 && i !== calculatedChartData.stackedData.length - 1 && i % showEvery !== 0) return null

                    return (
                      <g key={i}>
                        <line
                          x1={dayData.x}
                          y1={calculatedChartData.height - calculatedChartData.padding.bottom}
                          x2={dayData.x}
                          y2={calculatedChartData.height - calculatedChartData.padding.bottom + 5}
                          stroke="#2d5a4f"
                          strokeWidth="1"
                        />
                        <text
                          x={dayData.x}
                          y={calculatedChartData.height - calculatedChartData.padding.bottom + 18}
                          textAnchor="middle"
                          className="fill-[#868d8f]"
                          style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatDateAxis(dayData.date)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Stacked areas */}
                  {calculatedChartData.protocols.map((protocol) => {
                    // Filter out protocols with no data to avoid rendering errors
                    const hasData = calculatedChartData.stackedData.some((day) =>
                      day.points.some((p) => p.protocol === protocol && p.value > 0),
                    )

                    if (!hasData) return null

                    // Create the area path for this protocol
                    let pathData = ""

                    // Bottom line (cumulative bottom of this protocol)
                    calculatedChartData.stackedData.forEach((dayData, i) => {
                      const point = dayData.points.find((p) => p.protocol === protocol)
                      if (point) {
                        const bottomY = point.y + point.height
                        if (i === 0) {
                          pathData += `M ${point.x} ${bottomY}`
                        } else {
                          pathData += ` L ${point.x} ${bottomY}`
                        }
                      }
                    })

                    // Top line (cumulative top of this protocol) - reverse order
                    for (let i = calculatedChartData.stackedData.length - 1; i >= 0; i--) {
                      const dayData = calculatedChartData.stackedData[i]
                      const point = dayData.points.find((p) => p.protocol === protocol)
                      if (point) {
                        pathData += ` L ${point.x} ${point.y}`
                      }
                    }

                    pathData += " Z" // Close the path

                    return (
                      <path
                        key={protocol}
                        d={pathData}
                        fill={protocolColors[protocol] || "#06b6d4"}
                        className="transition-all duration-300"
                      />
                    )
                  })}

                  {/* Hover line */}
                  {tooltip.show && (
                    <line
                      x1={tooltip.x}
                      y1={calculatedChartData.padding.top}
                      x2={tooltip.x}
                      y2={calculatedChartData.height - calculatedChartData.padding.bottom}
                      stroke="#20a67d"
                      strokeWidth="1"
                      opacity="0.8"
                      strokeDasharray="2,2"
                    />
                  )}
                </>
              )}
            </svg>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-gray-400 text-sm">Loading chart...</span>
            </div>
          )}

          {/* Tooltip */}
          {tooltip.show && tooltip.data && (
            <div
              className="absolute z-50 bg-[#0f1a1f] rounded-lg px-4 py-3 text-sm pointer-events-none shadow-xl border border-[#20a67d] min-w-[240px] max-w-[280px]"
              style={{
                left:
                  tooltip.x > chartDimensions.width / 2
                    ? `${(Math.max(0, Math.min(chartDimensions.width - 280, tooltip.x - 280)) / chartDimensions.width) * 100}%`
                    : `${(Math.max(0, Math.min(chartDimensions.width - 280, tooltip.x + 20)) / chartDimensions.width) * 100}%`,
                top: `${(Math.max(10, Math.min(chartDimensions.height - 400, tooltip.y - 200)) / chartDimensions.height) * 100}%`,
              }}
            >
              <div className="text-white font-bold text-sm mb-2">{formatDateTooltip(tooltip.date)}</div>
              <div className="text-white font-bold mb-2 text-sm">Total: {formatValue(tooltip.data.total)}</div>
              <div className="space-y-1">
                {tooltip.data.points
                  .filter((point) => point.value > 0)
                  .sort((a, b) => b.value - a.value)
                  .map((point) => (
                    <div key={point.protocol} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: protocolColors[point.protocol] }}
                        />
                        <span className="text-xs text-gray-300 truncate">{point.protocol}</span>
                      </div>
                      <span className="text-xs text-white font-mono">{formatValue(point.value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Protocol Legend - Hidden on mobile (<400px) */}
        {!isMobile && (
          <div className="w-36 pl-3 py-2 border-l border-[#1a2e2a]">
            <div className="text-xs font-medium text-gray-400 mb-3">Protocols</div>
            <div className="space-y-1">
              {latestProtocolData
                .filter((p) => p.value > 0)
                .map(({ protocol, value }) => (
                  <div key={protocol} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: protocolColors[protocol] }}
                      />
                      <span className="text-[10px] text-gray-300 truncate">{protocol}</span>
                    </div>
                    <span className="text-[10px] text-white font-mono ml-2">{formatValue(value)}</span>
                  </div>
                ))}
            </div>
            {latestProtocolData.length > 0 && (
              <div className="border-t border-gray-600 mt-3 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Total</span>
                  <span className="text-sm text-white font-mono font-bold">
                    {formatValue(latestProtocolData.reduce((sum, p) => sum + (p.value as number), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
