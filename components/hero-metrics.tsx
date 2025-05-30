"use client"
import { useCryptoData } from "@/hooks/use-crypto-data"
import { CardContent } from "@/components/ui/card"

import { Card } from "@/components/ui/card"

import { useDuneData } from "@/hooks/use-dune-data"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { useRevenueData } from "@/hooks/use-revenue-data"
import { useState, useMemo, useRef, useEffect } from "react"

export default function HeroMetrics() {
  const { data: cryptoData, loading: cryptoLoading, error: cryptoError } = useCryptoData()
  const { data: duneData, loading: duneLoading, error: duneError } = useDuneData()
  const { data: hyperEVMData, loading: hyperEVMLoading, error: hyperEVMError } = useHyperEVMData()
  const { data: revenueData, loading: revenueLoading, error: revenueError } = useRevenueData()

  // State for active metric
  const [activeMetric, setActiveMetric] = useState("tvl")
  const chartContainerRef = useRef(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 800, height: 400 })
  const [timePeriod, setTimePeriod] = useState("7D")

  // Add this after the existing state declarations
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  // Update chart dimensions when container size changes
  useEffect(() => {
    if (!chartContainerRef.current) return

    const updateDimensions = () => {
      const { width, height } = chartContainerRef.current.getBoundingClientRect()
      setChartDimensions({ width, height })
    }

    // Initial measurement
    updateDimensions()

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(chartContainerRef.current)

    return () => {
      if (chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current)
      }
    }
  }, [])

  // Dynamic data fetching based on time period
  const [historicalData, setHistoricalData] = useState({})
  const [loadingHistorical, setLoadingHistorical] = useState(false)

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoadingHistorical(true)
      try {
        // Fetch historical data for different time periods
        const timestamp = Date.now()
        const [duneHistorical, revenueHistorical] = await Promise.all([
          fetch(`/api/dune-data?period=${timePeriod.toLowerCase()}&_t=${timestamp}`).then((res) => res.json()),
          fetch(`/api/revenue-data?period=${timePeriod.toLowerCase()}&_t=${timestamp}`).then((res) => res.json()),
        ])

        setHistoricalData({
          tvl: duneHistorical.historical_tvl || [],
          dailyRevenue: revenueHistorical.historical_daily_revenue || [],
          annualizedRevenue: revenueHistorical.historical_annualized_revenue || [],
          wallets: duneHistorical.historical_wallets || [],
        })
      } catch (error) {
        console.error("Error fetching historical data:", error)
        // Fallback to existing static data
        setHistoricalData(graphData)
      } finally {
        setLoadingHistorical(false)
      }
    }

    fetchHistoricalData()
  }, [timePeriod, duneData, revenueData])

  // Test data for all charts - expanded for better visualization
  const [graphData] = useState({
    tvl: [
      { date: "2025-04-20", value: 2750000000 },
      { date: "2025-04-22", value: 2780000000 },
      { date: "2025-04-24", value: 2760000000 },
      { date: "2025-04-26", value: 2800000000 },
      { date: "2025-04-28", value: 2820000000 },
      { date: "2025-04-30", value: 2840000000 },
      { date: "2025-05-02", value: 2860000000 },
      { date: "2025-05-04", value: 2880000000 },
      { date: "2025-05-05", value: 2842143715 },
    ],
    dailyRevenue: [
      { date: "2025-04-20", value: 2200000 },
      { date: "2025-04-22", value: 2350000 },
      { date: "2025-04-24", value: 2400000 },
      { date: "2025-04-26", value: 2500000 },
      { date: "2025-04-28", value: 2600000 },
      { date: "2025-04-30", value: 2550000 },
      { date: "2025-05-02", value: 2650000 },
      { date: "2025-05-04", value: 2580000 },
      { date: "2025-05-05", value: 2570000 },
    ],
    annualizedRevenue: [
      { date: "2025-04-20", value: 940000000 },
      { date: "2025-04-22", value: 945000000 },
      { date: "2025-04-24", value: 950000000 },
      { date: "2025-04-26", value: 955000000 },
      { date: "2025-04-28", value: 957000000 },
      { date: "2025-04-30", value: 956000000 },
      { date: "2025-05-02", value: 960000000 },
      { date: "2025-05-04", value: 958000000 },
      { date: "2025-05-05", value: 957000000 },
    ],
    wallets: [
      { date: "2025-04-20", value: 495000 },
      { date: "2025-04-22", value: 497000 },
      { date: "2025-04-24", value: 499000 },
      { date: "2025-04-26", value: 500000 },
      { date: "2025-04-28", value: 501000 },
      { date: "2025-04-30", value: 502000 },
      { date: "2025-05-02", value: 502500 },
      { date: "2025-04-04", value: 503000 },
      { date: "2025-05-05", value: 503463 },
    ],
  })

  // Enhanced Interactive SVG Chart
  const SVGChart = ({ data, color = "#20a67d", width, height }) => {
    const [hoveredPoint, setHoveredPoint] = useState(null)
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, value: 0, date: "" })

    // Define formatValue function before it's used
    const formatValue = (value, isYAxis = false) => {
      // Check if we're displaying wallet counts (no dollar sign)
      if (activeMetric === "wallets") {
        if (isYAxis) {
          // For Y-axis, use abbreviated format for large numbers
          if (value >= 1e6) return `${Math.round(value / 1e6)}M`
          else if (value >= 1e3) return `${Math.round(value / 1e3)}K`
          return Math.round(value).toString()
        } else {
          // For tooltip, use comma-separated format
          return value.toLocaleString()
        }
      }

      // For monetary values (TVL, revenue)
      if (value >= 1e9) {
        // 1B+: $X.XXB (2 decimal places for both tooltips and Y-axis)
        return `$${(value / 1e9).toFixed(2)}B`
      } else if (value >= 10e6) {
        // 10M-999M: $XX.XM (1 decimal place)
        return `$${(value / 1e6).toFixed(1)}M`
      } else if (value >= 1e6) {
        // 1M-9.9M: $X.XXM (2 decimal places)
        return `$${(value / 1e6).toFixed(2)}M`
      } else if (value >= 1e3) {
        return isYAxis ? `$${Math.round(value / 1e3)}K` : `$${(value / 1e3).toFixed(1)}K`
      }
      return `$${Math.round(value)}`
    }

    // Format date for tooltip (with year)
    const formatDateTooltip = (dateStr) => {
      if (!dateStr) return "Invalid Date"

      try {
        // Parse date in UTC to avoid timezone issues
        const date = new Date(dateStr + "T12:00:00Z")
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      } catch (e) {
        console.error("Date parsing error:", e, dateStr)
        return "Invalid Date"
      }
    }

    // Format date for X-axis (without year)
    const formatDateAxis = (dateStr) => {
      if (!dateStr) return "Invalid"

      try {
        // Parse date in UTC to avoid timezone issues
        const date = new Date(dateStr + "T12:00:00Z")
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      } catch (e) {
        console.error("Date parsing error:", e, dateStr)
        return "Invalid"
      }
    }

    const chartData = useMemo(() => {
      if (!data || data.length === 0) {
        const isNarrow = width < 600
        const isMobile = width < 400
        const chartWidth = width || 800
        const chartHeight = height || 400
        const padding = {
          top: 30,
          right: isNarrow ? 20 : 30,
          bottom: isNarrow ? 40 : 50,
          left: isNarrow ? 50 : 60,
        }

        return {
          points: [],
          minValue: 0,
          maxValue: 0,
          pathData: "",
          areaPath: "",
          width: chartWidth,
          height: chartHeight,
          padding,
          isNarrow,
          isMobile,
        }
      }

      // Filter out zero values for annualized revenue on MAX time period
      let filteredData = data
      if (activeMetric === "annualizedRevenue" && timePeriod === "MAX") {
        filteredData = data.filter((d) => d.value > 0)
      }

      const values = filteredData.map((d) => d.value)
      const dataMin = Math.min(...values)
      const dataMax = Math.max(...values)

      // Simpler approach - just add 10% padding above and below
      const range = dataMax - dataMin
      const paddingValue = Math.max(range * 0.05, dataMax * 0.01) // Reduced from 0.1 and 0.02
      let minValue = dataMin - paddingValue
      const maxValue = dataMax + paddingValue

      // Ensure minimum value doesn't go below 0 for positive data
      if (dataMin >= 0 && minValue < 0) {
        minValue = 0
      }

      // Responsive adjustments based on width
      const isNarrow = width < 600
      const isMobile = width < 400

      const chartWidth = width || 800
      const chartHeight = height || 400
      const padding = {
        top: 30,
        right: isNarrow ? 20 : 30,
        bottom: isNarrow ? 40 : 50,
        left: isNarrow ? 50 : 60,
      }

      const finalRange = maxValue - minValue

      const points = filteredData.map((d, i) => ({
        x: padding.left + (i / (filteredData.length - 1)) * (chartWidth - padding.left - padding.right),
        y:
          chartHeight -
          padding.bottom -
          ((d.value - minValue) / finalRange) * (chartHeight - padding.top - padding.bottom),
        value: d.value,
        date: d.date,
        index: i,
      }))

      // Create smooth curve path using cubic bezier curves
      const pathData = points.reduce((path, point, i) => {
        if (i === 0) return `M ${point.x} ${point.y}`

        return `${path} L ${point.x} ${point.y}`
      }, "")

      // Create area path for gradient fill
      const areaPath = `${pathData} L ${points[points.length - 1]?.x} ${chartHeight - padding.bottom} L ${points[0]?.x} ${chartHeight - padding.bottom} Z`

      return {
        points,
        minValue,
        maxValue,
        width: chartWidth,
        height: chartHeight,
        pathData,
        areaPath,
        padding,
        isNarrow,
        isMobile,
      }
    }, [data, width, height, activeMetric, timePeriod])

    // Generate Y-axis labels with nice even increments
    const yAxisLabels = useMemo(() => {
      if (!chartData || !chartData.padding) return []

      const { minValue, maxValue, height, padding, isNarrow } = chartData
      const range = maxValue - minValue
      const steps = isNarrow ? 4 : 5

      // Simple step calculation
      const stepSize = range / steps

      const labels = []
      for (let i = 0; i <= steps; i++) {
        const currentValue = minValue + stepSize * i
        const y =
          height - padding.bottom - ((currentValue - minValue) / range) * (height - padding.top - padding.bottom)

        labels.push({
          value: currentValue,
          y,
          label: formatValue(currentValue, true), // Pass true for Y-axis formatting
        })
      }

      return labels
    }, [chartData])

    const handleMouseMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const scaledMouseX = (mouseX / rect.width) * chartData.width
      const scaledMouseY = (mouseY / rect.height) * chartData.height

      // Constrain to chart area only
      if (scaledMouseX < chartData.padding.left || scaledMouseX > chartData.width - chartData.padding.right) {
        setTooltip({ ...tooltip, show: false })
        setHoveredPoint(null)
        return
      }

      // Find closest data point
      const dataX = scaledMouseX - chartData.padding.left
      const chartWidth = chartData.width - chartData.padding.left - chartData.padding.right
      const dataIndex = Math.round((dataX / chartWidth) * (chartData.points.length - 1))
      const clampedIndex = Math.max(0, Math.min(chartData.points.length - 1, dataIndex))

      if (chartData.points[clampedIndex]) {
        const point = chartData.points[clampedIndex]
        setTooltip({
          show: true,
          x: point.x, // Use the actual data point X position instead of mouse X
          y: scaledMouseY, // Keep mouse Y for tooltip positioning
          value: point.value,
          date: point.date,
        })
        setHoveredPoint(clampedIndex)
      }
    }

    // Calculate tooltip position with simpler boundary handling
    const tooltipLeft = (tooltip.x / chartData.width) * 100
    const tooltipTop = (tooltip.y / chartData.height) * 100

    // Simple left/right positioning based on chart center
    const isRightHalf = tooltip.x > chartData.width / 2
    const tooltipTransform = isRightHalf ? "translate(calc(-100% - 20px), -50%)" : "translate(20px, -50%)"

    // Responsive font sizes and stroke widths
    const fontSize = chartData?.isNarrow ? "8px" : "10px"
    const strokeWidth = chartData?.isNarrow ? 2 : 3
    const pointRadius = chartData?.isNarrow ? 3 : 4
    const hoveredPointRadius = chartData?.isNarrow ? 5 : 6

    return (
      <div className="w-full h-full relative">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${chartData.width} ${chartData.height}`}
          className="overflow-visible cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setTooltip({ ...tooltip, show: false })
            setHoveredPoint(null)
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            const touch = e.touches[0]
            const rect = e.currentTarget.getBoundingClientRect()
            const touchX = touch.clientX - rect.left
            const touchY = touch.clientY - rect.top
            const scaledTouchX = (touchX / rect.width) * chartData.width
            const scaledTouchY = (touchY / rect.height) * chartData.height

            // Use the same logic as mouse move
            if (scaledTouchX < chartData.padding.left || scaledTouchX > chartData.width - chartData.padding.right) {
              setTooltip({ ...tooltip, show: false })
              setHoveredPoint(null)
              return
            }

            const dataX = scaledTouchX - chartData.padding.left
            const chartWidth = chartData.width - chartData.padding.left - chartData.padding.right
            const dataIndex = Math.round((dataX / chartWidth) * (chartData.points.length - 1))
            const clampedIndex = Math.max(0, Math.min(chartData.points.length - 1, dataIndex))

            if (chartData.points[clampedIndex]) {
              const point = chartData.points[clampedIndex]
              setTooltip({
                show: true,
                x: point.x,
                y: scaledTouchY,
                value: point.value,
                date: point.date,
              })
              setHoveredPoint(clampedIndex)
            }
          }}
          onTouchMove={(e) => {
            e.preventDefault()
            const touch = e.touches[0]
            const rect = e.currentTarget.getBoundingClientRect()
            const touchX = touch.clientX - rect.left
            const touchY = touch.clientY - rect.top
            const scaledTouchX = (touchX / rect.width) * chartData.width
            const scaledTouchY = (touchY / rect.height) * chartData.height

            // Use the same logic as mouse move
            if (scaledTouchX < chartData.padding.left || scaledTouchX > chartData.width - chartData.padding.right) {
              setTooltip({ ...tooltip, show: false })
              setHoveredPoint(null)
              return
            }

            const dataX = scaledTouchX - chartData.padding.left
            const chartWidth = chartData.width - chartData.padding.left - chartData.padding.right
            const dataIndex = Math.round((dataX / chartWidth) * (chartData.points.length - 1))
            const clampedIndex = Math.max(0, Math.min(chartData.points.length - 1, dataIndex))

            if (chartData.points[clampedIndex]) {
              const point = chartData.points[clampedIndex]
              setTooltip({
                show: true,
                x: point.x,
                y: scaledTouchY,
                value: point.value,
                date: point.date,
              })
              setHoveredPoint(clampedIndex)
            }
          }}
          onTouchEnd={() => {
            setTooltip({ ...tooltip, show: false })
            setHoveredPoint(null)
          }}
        >
          <defs>
            {/* Gradient for area fill */}
            <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="50%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Watermark - Center */}
          <text
            x={chartData.width / 2}
            y={chartData.height * 0.2}
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

          {/* Watermark - Top */}
          {/* Removed as requested */}

          {/* Y-axis */}
          <line
            x1={chartData.padding.left}
            y1={chartData.padding.top}
            x2={chartData.padding.left}
            y2={chartData.height - chartData.padding.bottom}
            stroke="#2d5a4f"
            strokeWidth="1"
          />

          {/* X-axis */}
          <line
            x1={chartData.padding.left}
            y1={chartData.height - chartData.padding.bottom}
            x2={chartData.width - chartData.padding.right}
            y2={chartData.height - chartData.padding.bottom}
            stroke="#2d5a4f"
            strokeWidth="1"
          />

          {/* Y-axis labels */}
          {yAxisLabels.map((label, i) => (
            <g key={i}>
              {/* Horizontal grid line */}
              <line
                x1={chartData.padding.left}
                y1={label.y}
                x2={chartData.width - chartData.padding.right}
                y2={label.y}
                stroke="#2d5a4f"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <line
                x1={chartData.padding.left - 5}
                y1={label.y}
                x2={chartData.padding.left}
                y2={label.y}
                stroke="#2d5a4f"
                strokeWidth="1"
              />
              <text
                x={chartData.padding.left - 10}
                y={label.y + 4}
                textAnchor="end"
                className="fill-[#868d8f]"
                style={{ fontSize, fontFamily: "JetBrains Mono, monospace" }}
              >
                {label.label}
              </text>
            </g>
          ))}

          {/* X-axis labels - show fewer on longer time periods */}
          {chartData.points.map((point, i) => {
            // Dynamic label frequency based on data length and screen size
            let showEvery = 1
            if (chartData.isMobile) {
              // More aggressive reduction for mobile screens, but keep 7D as is
              if (chartData.points.length > 30)
                showEvery = Math.ceil(chartData.points.length / 4) // MAX/90D view on mobile
              else if (chartData.points.length > 7) showEvery = Math.ceil(chartData.points.length / 3) // 30D view on mobile
              // Remove the 7D mobile override - let it use default showEvery = 1
            } else if (chartData.isNarrow) {
              // Tablet/narrow screens
              if (chartData.points.length > 90)
                showEvery = Math.ceil(chartData.points.length / 8) // MAX view
              else if (chartData.points.length > 30)
                showEvery = Math.ceil(chartData.points.length / 6) // 90D view
              else if (chartData.points.length > 7)
                showEvery = Math.ceil(chartData.points.length / 4) // 30D view
              else showEvery = 2 // 7D narrow screens
            } else {
              // Desktop
              if (chartData.points.length > 90)
                showEvery = Math.ceil(chartData.points.length / 10) // MAX view
              else if (chartData.points.length > 30)
                showEvery = Math.ceil(chartData.points.length / 8) // 90D view
              else if (chartData.points.length > 7) showEvery = Math.ceil(chartData.points.length / 6) // 30D view
            }

            // Always show first and last point, skip others based on showEvery
            if (i !== 0 && i !== chartData.points.length - 1 && i % showEvery !== 0) return null

            return (
              <g key={i}>
                <line
                  x1={point.x}
                  y1={chartData.height - chartData.padding.bottom}
                  x2={point.x}
                  y2={chartData.height - chartData.padding.bottom + 5}
                  stroke="#2d5a4f"
                  strokeWidth="1"
                />
                <text
                  x={point.x}
                  y={chartData.height - chartData.padding.bottom + 18}
                  textAnchor="middle"
                  className="fill-[#868d8f]"
                  style={{ fontSize, fontFamily: "JetBrains Mono, monospace" }}
                >
                  {formatDateAxis(point.date)}
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          <path
            d={chartData.areaPath}
            fill={`url(#gradient-${color.replace("#", "")})`}
            className="transition-all duration-500"
          />

          {/* Main line */}
          <path
            d={chartData.pathData}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            filter="url(#glow)"
            className="transition-all duration-500"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover line - constrained to chart area */}
          {tooltip.show &&
            tooltip.x >= chartData.padding.left &&
            tooltip.x <= chartData.width - chartData.padding.right && (
              <line
                x1={tooltip.x}
                y1={chartData.padding.top}
                x2={tooltip.x}
                y2={chartData.height - chartData.padding.bottom}
                stroke={color}
                strokeWidth="1"
                opacity="0.8"
                strokeDasharray="2,2"
              />
            )}

          {/* Tracking dot that snaps to the line position */}
          {tooltip.show && hoveredPoint !== null && chartData.points[hoveredPoint] && (
            <circle
              cx={chartData.points[hoveredPoint].x}
              cy={chartData.points[hoveredPoint].y}
              r="4"
              fill={color}
              stroke="#0f1a1f"
              strokeWidth="2"
              style={{
                filter: `drop-shadow(0 0 6px ${color}80)`,
              }}
            />
          )}
        </svg>

        {/* Enhanced Tooltip */}
        {tooltip.show && (
          <div
            className="absolute z-50 bg-[#0f1a1f] rounded-lg px-4 py-3 text-sm pointer-events-none shadow-xl"
            style={{
              left: `${tooltipLeft}%`,
              top: `${tooltipTop}%`,
              transform: tooltipTransform,
              border: `1px solid ${color}`,
              boxShadow: `0 0 20px ${color}40`,
            }}
          >
            <div className="text-white font-bold text-base mb-1">{formatValue(tooltip.value, false)}</div>
            <div className="text-[#868d8f] text-xs">{formatDateTooltip(tooltip.date)}</div>
          </div>
        )}
      </div>
    )
  }

  // Helper functions
  const formatTVL = (tvl: number | null | undefined): string => {
    if (!tvl || tvl === 0) return "TO DO"
    const absTvl = Math.abs(tvl)
    if (absTvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
    else if (absTvl >= 100e6) return `$${Math.round(tvl / 1e6)}M`
    else if (absTvl >= 10e6) return `$${(tvl / 1e6).toFixed(1)}M`
    else if (absTvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
    else if (absTvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`
    else return `$${tvl.toFixed(2)}`
  }

  const formatNetflow = (netflow: number | null | undefined): string => {
    if (netflow === null || netflow === undefined) return ""
    const absNetflow = Math.abs(netflow)
    const prefix = netflow >= 0 ? "+" : "-"

    if (absNetflow >= 1e6) return `${prefix}$${(absNetflow / 1e6).toFixed(2)}M today`
    else if (absNetflow >= 1e3) return `${prefix}$${(absNetflow / 1e3).toFixed(1)}K today`
    else return `${prefix}$${absNetflow.toFixed(2)} today`
  }

  const formatWallets = (count: number | null | undefined): string => {
    if (!count || count === 0) return "TO DO"
    return count.toLocaleString()
  }

  const formatDailyWallets = (count: number | null | undefined): string => {
    if (count === null || count === undefined) return ""
    return `${count.toLocaleString()} today`
  }

  const formatRevenue = (revenue: number | null | undefined): string => {
    if (!revenue || revenue === 0) return "TO DO"
    const absRevenue = Math.abs(revenue)
    if (absRevenue >= 1e6) return `$${(revenue / 1e6).toFixed(2)}M`
    else if (absRevenue >= 100e3) return `$${Math.round(revenue / 1e3)}K`
    else if (absRevenue >= 1e3) return `$${(revenue / 1e3).toFixed(2)}K`
    else return `$${revenue.toFixed(2)}`
  }

  const metrics = [
    {
      id: "tvl",
      title: "USDC Bridged",
      value: duneLoading ? (
        <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
      ) : duneData ? (
        formatTVL(duneData.tvl)
      ) : (
        "TO DO"
      ),
      change: duneLoading ? "" : duneData ? formatNetflow(duneData.netflow) : "",
      isPositive: duneData ? duneData.netflow >= 0 : true,
      isLoading: duneLoading,
    },
    {
      id: "dailyRevenue",
      title: "Daily Revenue",
      value: revenueLoading ? (
        <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
      ) : revenueData && revenueData.daily_revenue > 0 ? (
        formatRevenue(revenueData.daily_revenue)
      ) : (
        "TO DO"
      ),
      change: revenueLoading
        ? ""
        : revenueData && revenueData.previous_day_revenue && revenueData.daily_revenue
          ? `${revenueData.daily_revenue >= 0 ? "▲" : "▼"} ${formatRevenue(Math.abs(revenueData.daily_revenue - revenueData.previous_day_revenue))} 24h`
          : "",
      isPositive:
        revenueData && revenueData.previous_day_revenue
          ? revenueData.daily_revenue - revenueData.previous_day_revenue >= 0
          : true,
      isLoading: revenueLoading,
    },
    {
      id: "annualizedRevenue",
      title: "Annualized Revenue",
      value: revenueLoading ? (
        <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
      ) : revenueData && revenueData.annualized_revenue > 0 ? (
        formatTVL(revenueData.annualized_revenue)
      ) : (
        "TO DO"
      ),
      change: (() => {
        if (revenueLoading) return ""

        // Use historical data to calculate change
        const annualizedHistoricalData = historicalData.annualizedRevenue || graphData.annualizedRevenue || []
        if (annualizedHistoricalData.length >= 2) {
          const today = annualizedHistoricalData[annualizedHistoricalData.length - 1]
          const yesterday = annualizedHistoricalData[annualizedHistoricalData.length - 2]
          if (today && yesterday) {
            const difference = today.value - yesterday.value
            const isPositive = difference >= 0
            return `${isPositive ? "▲" : "▼"} ${formatTVL(Math.abs(difference))} 24h`
          }
        }
        return ""
      })(),
      isPositive: (() => {
        const annualizedHistoricalData = historicalData.annualizedRevenue || graphData.annualizedRevenue || []
        if (annualizedHistoricalData.length >= 2) {
          const today = annualizedHistoricalData[annualizedHistoricalData.length - 1]
          const yesterday = annualizedHistoricalData[annualizedHistoricalData.length - 2]
          if (today && yesterday) {
            return today.value >= yesterday.value
          }
        }
        return true
      })(),
      isLoading: revenueLoading,
    },
    {
      id: "wallets",
      title: "Total Wallets",
      value: duneLoading ? (
        <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
      ) : duneData ? (
        formatWallets(duneData.total_wallets)
      ) : (
        "TO DO"
      ),
      change: duneLoading
        ? ""
        : duneData && duneData.address_count
          ? `▲ ${duneData.address_count.toLocaleString()} today`
          : "",
      isPositive: true,
      isLoading: duneLoading,
    },
  ]

  const currentGraphData = historicalData[activeMetric] || graphData[activeMetric] || []

  const getGraphTitle = () => {
    const metric = metrics.find((m) => m.id === activeMetric)
    if (!metric) return ""

    // Use abbreviated titles on mobile/narrow screens
    if (chartDimensions.width < 400) {
      switch (metric.id) {
        case "tvl":
          return "USDC Bridged"
        case "dailyRevenue":
          return "Daily Rev."
        case "annualizedRevenue":
          return "Annualized Rev."
        case "wallets":
          return "Total Wallets"
        default:
          return metric.title
      }
    }

    return metric.title
  }

  const getGraphColor = () => {
    switch (activeMetric) {
      case "tvl":
        return "#20a67d" // Keep the signature green
      case "dailyRevenue":
        return "#4f9eff" // Brighter, more vibrant blue
      case "annualizedRevenue":
        return "#ff8c42" // Warm orange instead of gold
      case "wallets":
        return "#8b5cf6" // Modern purple
      default:
        return "#20a67d"
    }
  }

  return (
    <div className="flex flex-col lg:flex-row mt-8 gap-6">
      {/* Cards - 2x2 grid on mobile/tablet, vertical column on desktop */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-[200px] lg:h-[528px] lg:gap-0">
        {metrics.map((metric, index) => (
          <Card
            key={index}
            className={`w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden cursor-pointer transition-all duration-300 ${
              activeMetric === metric.id
                ? `ring-1 ring-offset-2 ring-offset-[#0f1a1f] ring-inset ring-[${
                    metric.id === "tvl"
                      ? "#20a67d"
                      : metric.id === "dailyRevenue"
                        ? "#4f9eff"
                        : metric.id === "annualizedRevenue"
                          ? "#ff8c42"
                          : "#8b5cf6"
                  }]`
                : "hover:bg-[#132824] hover:border-[#20a67d50]"
            }`}
            onClick={() => setActiveMetric(metric.id)}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-[#a0a8aa] text-xs font-medium">
                <span className="sm:hidden">
                  {metric.id === "annualizedRevenue" ? "Annualized Rev." : metric.title}
                </span>
                <span className="hidden sm:inline">{metric.title}</span>
              </h3>
              {activeMetric === metric.id && (
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      metric.id === "tvl"
                        ? "#20a67d"
                        : metric.id === "dailyRevenue"
                          ? "#4f9eff"
                          : metric.id === "annualizedRevenue"
                            ? "#ff8c42"
                            : "#8b5cf6",
                  }}
                ></div>
              )}
            </div>
            <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
              {metric.isLoading ? (
                <div className="flex flex-col">
                  <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                  <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                </div>
              ) : (
                <div className="flex flex-col justify-start space-y-2">
                  <p className="text-2xl font-bold text-white font-teodor tracking-tight">{metric.value}</p>
                  <div className="flex items-center h-4">
                    {metric.change && (
                      <span
                        className={`text-xs font-medium ${metric.isPositive ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {metric.change}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graph */}
      <div className="flex-1 min-w-0">
        <Card className="bg-[#062722] rounded-[10px] shadow-xl drop-shadow-lg overflow-hidden border-0 h-[528px] flex flex-col">
          <div className="bg-[#0f1a1f] px-4 py-2 flex justify-between items-center h-[50px]">
            <h3 className="text-[#868d8f] text-sm font-medium font-sans">{getGraphTitle()}</h3>
            <div className="flex gap-1">
              {["7D", "30D", "90D", "MAX"].map((period) => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
                    timePeriod === period
                      ? "bg-[#00c2c2] text-white"
                      : "text-[#868d8f] hover:text-white hover:bg-[#00c2c280]"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="bg-[#0f1a1f] p-0 flex-1 overflow-hidden">
            <div ref={chartContainerRef} className="w-full h-full">
              <SVGChart
                data={currentGraphData}
                color={getGraphColor()}
                width={chartDimensions.width}
                height={chartDimensions.height}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
