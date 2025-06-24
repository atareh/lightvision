"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"

interface HyperEVMChartProps {
  chartData: Array<{
    date: string
    total: number
    protocols: Record<string, number>
  }>
  isLoading?: boolean
}

export default function HyperEVMChart({ chartData: dataFromProp, isLoading }: HyperEVMChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null, date: "" })
  const [protocolColors, setProtocolColors] = useState({})
  const chartContainerRef = useRef(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 })
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 400 : false)

  const [isFading, setIsFading] = useState(false)
  const previousChartDataRef = useRef<HyperEVMChartProps["chartData"]>()

  // Use the chartData prop directly
  const chartData = useMemo(() => dataFromProp || [], [dataFromProp])

  useEffect(() => {
    if (previousChartDataRef.current && previousChartDataRef.current !== chartData) {
      setIsFading(true)
      const timer = setTimeout(() => {
        setIsFading(false)
      }, 50) // Short delay to allow opacity to apply before fading back in
      // Clear timeout on unmount or if data changes again quickly
      return () => clearTimeout(timer)
    }
    previousChartDataRef.current = chartData
  }, [chartData])

  // Generate colors for protocols
  useEffect(() => {
    if (!chartData || chartData.length === 0) {
      setProtocolColors({})
      return
    }
    const allProtocols = new Set()
    chartData.forEach((day) => {
      Object.keys(day.protocols || {}).forEach((protocol) => {
        allProtocols.add(protocol)
      })
    })
    const sortedProtocols = Array.from(allProtocols).sort()
    const colors = {}
    const colorPalette = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#f97316",
      "#84cc16",
      "#ec4899",
      "#6366f1",
      "#14b8a6",
      "#eab308",
      "#dc2626",
      "#059669",
      "#7c3aed",
      "#f43f5e",
      "#06b6d4",
      "#8b5cf6",
      "#f97316",
      "#22c55e",
    ]
    sortedProtocols.forEach((protocol, index) => {
      colors[protocol] = colorPalette[index % colorPalette.length]
    })
    setProtocolColors(colors)
  }, [chartData])

  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect()
        setChartDimensions({ width, height })
      }
    }
    if (chartContainerRef.current) updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current)
    return () => {
      if (chartContainerRef.current) resizeObserver.unobserve(chartContainerRef.current)
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 400)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const formatValue = (value: number, isYAxis = false) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 10e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return isYAxis ? `$${Math.round(value / 1e3)}K` : `$${(value / 1e3).toFixed(1)}K`
    return `$${Math.round(value)}`
  }

  const formatDateTooltip = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00Z`)
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  }

  const formatDateAxis = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00Z`)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  }

  const calculatedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0 || chartDimensions.width === 0 || chartDimensions.height === 0) {
      return {
        stackedData: [],
        protocols: [],
        maxValue: 0,
        width: chartDimensions.width || 1000,
        height: chartDimensions.height || 400,
        padding: { top: 40, right: 20, bottom: 50, left: 60 },
        isNarrow: false,
      }
    }
    const allProtocols = new Set<string>()
    chartData.forEach((day) => Object.keys(day.protocols || {}).forEach((p) => allProtocols.add(p)))
    const latestDay = chartData[chartData.length - 1]
    const protocols = Array.from(allProtocols).sort(
      (a, b) => (latestDay?.protocols?.[a] || 0) - (latestDay?.protocols?.[b] || 0),
    )
    const maxValue = Math.max(0, ...chartData.map((d) => d.total))
    const isNarrow = chartDimensions.width < 600
    const padding = { top: 40, bottom: 50, left: 60, right: 20 }
    const stackedData = chartData.map((dayData, dayIndex) => {
      const x =
        padding.left +
        (chartData.length > 1 ? dayIndex / (chartData.length - 1) : 0.5) *
          (chartDimensions.width - padding.left - padding.right)
      let cumulativeY = chartDimensions.height - padding.bottom
      const dayPoints = protocols.map((protocol) => {
        const value = dayData.protocols[protocol] || 0
        const height = maxValue > 0 ? (value / maxValue) * (chartDimensions.height - padding.top - padding.bottom) : 0
        const y = cumulativeY - height
        const point = { protocol, x, y, height, value, date: dayData.date, dayIndex }
        cumulativeY = y
        return point
      })
      return { date: dayData.date, total: dayData.total, x, points: dayPoints }
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

  const yAxisLabels = useMemo(() => {
    if (!calculatedChartData || calculatedChartData.maxValue === 0 || calculatedChartData.height === 0) return []
    const { maxValue, height, padding, isNarrow } = calculatedChartData
    const steps = isNarrow ? 3 : 4
    if (steps === 0) return []
    const stepSize = maxValue / steps
    return Array.from({ length: steps + 1 }).map((_, i) => {
      const value = stepSize * i
      const y =
        height - padding.bottom - (maxValue > 0 ? (value / maxValue) * (height - padding.top - padding.bottom) : 0)
      return { value, y, label: formatValue(value, true) }
    })
  }, [calculatedChartData])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMobile || !calculatedChartData.stackedData || calculatedChartData.stackedData.length === 0) {
      setTooltip((prev) => ({ ...prev, show: false }))
      setHoveredPoint(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scaledMouseX = (mouseX / rect.width) * chartDimensions.width
    const scaledMouseY = (mouseY / rect.height) * chartDimensions.height
    if (
      scaledMouseX < calculatedChartData.padding.left ||
      scaledMouseX > chartDimensions.width - calculatedChartData.padding.right
    ) {
      setTooltip((prev) => ({ ...prev, show: false }))
      setHoveredPoint(null)
      return
    }
    const chartAreaWidth = chartDimensions.width - calculatedChartData.padding.left - calculatedChartData.padding.right
    const relativeMouseX = scaledMouseX - calculatedChartData.padding.left
    let dayIndex = 0
    if (calculatedChartData.stackedData.length > 1 && chartAreaWidth > 0) {
      dayIndex = Math.round((relativeMouseX / chartAreaWidth) * (calculatedChartData.stackedData.length - 1))
    } else if (calculatedChartData.stackedData.length === 1) {
      dayIndex = 0
    } else {
      setTooltip((prev) => ({ ...prev, show: false }))
      setHoveredPoint(null)
      return
    }
    const clampedIndex = Math.max(0, Math.min(calculatedChartData.stackedData.length - 1, dayIndex))
    const dayData = calculatedChartData.stackedData[clampedIndex]
    if (dayData) {
      setTooltip({ show: true, x: dayData.x, y: scaledMouseY, data: dayData, date: dayData.date })
      setHoveredPoint(clampedIndex)
    } else {
      setTooltip((prev) => ({ ...prev, show: false }))
      setHoveredPoint(null)
    }
  }

  const latestProtocolData = useMemo(() => {
    if (!chartData || chartData.length === 0) return []
    const latest = chartData[chartData.length - 1]
    if (!latest || !latest.protocols) return []
    return Object.entries(latest.protocols)
      .map(([protocol, value]) => ({ protocol, value: value as number }))
      .sort((a, b) => b.value - a.value)
  }, [chartData])

  if (isLoading) {
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
  if (chartDimensions.width === 0 || chartDimensions.height === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="w-full flex-1 flex flex-row">
          <div className="flex-1 relative h-full" ref={chartContainerRef}>
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-gray-400 text-sm">Initializing chart...</span>
            </div>
          </div>
          {!isMobile && <div className="w-36 pl-3 py-2 border-l border-[#1a2e2a]"></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full flex-1 flex flex-row">
        <div
          className="flex-1 relative h-full"
          ref={chartContainerRef}
          style={{
            transition: "opacity 0.3s ease-in-out",
            opacity: isFading ? 0 : 1,
          }}
        >
          <svg
            width={chartDimensions.width}
            height={chartDimensions.height}
            viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
            className={`absolute top-0 left-0 w-full h-full ${isMobile ? "" : "cursor-crosshair"}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setTooltip((prev) => ({ ...prev, show: false }))
              setHoveredPoint(null)
            }}
          >
            <defs>
              {calculatedChartData.protocols.map((protocol) => {
                // Create a safe ID by removing special characters and ensuring uniqueness
                const safeId = `gradient-${protocol.replace(/[^a-zA-Z0-9]/g, "")}-${protocol.length}`
                return (
                  <linearGradient key={protocol} id={safeId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={protocolColors[protocol] || "#ccc"} stopOpacity="0.4" />
                    <stop offset="50%" stopColor={protocolColors[protocol] || "#ccc"} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={protocolColors[protocol] || "#ccc"} stopOpacity="0.05" />
                  </linearGradient>
                )
              })}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <text
              x={chartDimensions.width / 2}
              y={chartDimensions.height * 0.2}
              textAnchor="middle"
              className="fill-white"
              style={{
                fontSize: "24px",
                opacity: "0.08",
                fontFamily: "Teodor, Arial, sans-serif",
                pointerEvents: "none",
              }}
            >
              <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>Hype</tspan>
              <tspan style={{ fontStyle: "italic", fontWeight: "300" }}>Screener</tspan>
              <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>.xyz</tspan>
            </text>
            {calculatedChartData.width > 0 && calculatedChartData.height > 0 && (
              <>
                <line
                  x1={calculatedChartData.padding.left}
                  y1={calculatedChartData.padding.top}
                  x2={calculatedChartData.padding.left}
                  y2={calculatedChartData.height - calculatedChartData.padding.bottom}
                  stroke="#2d5a4f"
                  strokeWidth="1"
                />
                <line
                  x1={calculatedChartData.padding.left}
                  y1={calculatedChartData.height - calculatedChartData.padding.bottom}
                  x2={calculatedChartData.width - calculatedChartData.padding.right}
                  y2={calculatedChartData.height - calculatedChartData.padding.bottom}
                  stroke="#2d5a4f"
                  strokeWidth="1"
                />
                {yAxisLabels.map((label, i) => (
                  <g key={`y-label-${i}`}>
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
                {calculatedChartData.stackedData.map((dayData, i) => {
                  let showEvery = 1
                  const len = calculatedChartData.stackedData.length
                  if (isMobile) {
                    if (len > 30) showEvery = Math.ceil(len / 4)
                    else if (len > 7) showEvery = Math.ceil(len / 3)
                  } else if (calculatedChartData.isNarrow) {
                    if (len > 90) showEvery = Math.ceil(len / 8)
                    else if (len > 30) showEvery = Math.ceil(len / 6)
                    else if (len > 7) showEvery = Math.ceil(len / 4)
                    else showEvery = len > 1 ? 2 : 1
                  } else {
                    if (len > 90) showEvery = Math.ceil(len / 10)
                    else if (len > 30) showEvery = Math.ceil(len / 8)
                    else if (len > 7) showEvery = Math.ceil(len / 6)
                    else showEvery = len > 1 ? Math.max(1, Math.floor(len / 7)) : 1
                  }
                  if (i !== 0 && i !== len - 1 && i % showEvery !== 0 && len > 1) return null
                  return (
                    <g key={`x-label-${i}`}>
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
                {calculatedChartData.protocols.map((protocol) => {
                  const hasData = calculatedChartData.stackedData.some((day) =>
                    day.points.some((p) => p.protocol === protocol && p.value > 0),
                  )
                  if (!hasData) return null

                  let pathData = ""
                  let strokePath = ""

                  // Create area path (for fill)
                  calculatedChartData.stackedData.forEach((dayData, i) => {
                    const point = dayData.points.find((p) => p.protocol === protocol)
                    if (point) {
                      const bottomY = point.y + point.height
                      if (i === 0) pathData += `M ${point.x} ${bottomY}`
                      else pathData += ` L ${point.x} ${bottomY}`
                    }
                  })
                  for (let i = calculatedChartData.stackedData.length - 1; i >= 0; i--) {
                    const dayData = calculatedChartData.stackedData[i]
                    const point = dayData.points.find((p) => p.protocol === protocol)
                    if (point) pathData += ` L ${point.x} ${point.y}`
                  }
                  if (pathData) pathData += " Z"

                  // Create stroke path (top edge only)
                  calculatedChartData.stackedData.forEach((dayData, i) => {
                    const point = dayData.points.find((p) => p.protocol === protocol)
                    if (point) {
                      if (i === 0) strokePath += `M ${point.x} ${point.y}`
                      else strokePath += ` L ${point.x} ${point.y}`
                    }
                  })

                  // Use the same safe ID format as defined in the defs section
                  const safeId = `gradient-${protocol.replace(/[^a-zA-Z0-9]/g, "")}-${protocol.length}`

                  return (
                    <g key={protocol}>
                      {/* Area fill with gradient */}
                      <path d={pathData} fill={`url(#${safeId})`} className="transition-all duration-500" />
                      {/* Glowing stroke on top edge */}
                      <path
                        d={strokePath}
                        fill="none"
                        stroke={protocolColors[protocol] || "#06b6d4"}
                        strokeWidth="2"
                        filter="url(#glow)"
                        className="transition-all duration-500"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )
                })}
                {tooltip.show && hoveredPoint !== null && calculatedChartData.stackedData[hoveredPoint] && (
                  <line
                    x1={calculatedChartData.stackedData[hoveredPoint].x}
                    y1={calculatedChartData.padding.top}
                    x2={calculatedChartData.stackedData[hoveredPoint].x}
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
          {tooltip.show && tooltip.data && (
            <div
              className="absolute z-50 bg-[#0f1a1f] rounded-lg px-4 py-3 text-sm pointer-events-none shadow-xl min-w-[240px] max-w-[280px]"
              style={{
                left:
                  tooltip.x > chartDimensions.width / 2
                    ? `${Math.max(0, Math.min(chartDimensions.width - 280, tooltip.x - 280))}px`
                    : `${Math.max(0, Math.min(chartDimensions.width - 280, tooltip.x + 20))}px`,
                top: `${Math.max(10, Math.min(chartDimensions.height - 200, tooltip.y - 100))}px`,
                border: `1px solid #20a67d`,
                boxShadow: `0 0 20px #20a67d40`,
              }}
            >
              <div className="text-white font-bold text-base mb-1">{formatDateTooltip(tooltip.date)}</div>
              <div className="text-white font-bold mb-2 text-base">Total: {formatValue(tooltip.data.total)}</div>
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
                        <span className="text-xs text-[#868d8f] truncate">{point.protocol}</span>
                      </div>
                      <span className="text-xs text-white font-mono">{formatValue(point.value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        {!isMobile && (
          <div className="w-36 pl-3 py-2 border-l border-[#1a2e2a]">
            <div className="text-xs font-medium text-gray-400 mb-3">Protocols</div>
            <div className="space-y-1 max-h-[calc(100%-50px)] overflow-y-auto">
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
                    {formatValue(latestProtocolData.reduce((sum, p) => sum + p.value, 0))}
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
