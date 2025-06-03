"use client"

import type React from "react"
import { useMemo, useState } from "react"

export interface DataPoint {
  date: string
  value: number
}

export interface GenericAreaChartProps {
  data: DataPoint[]
  color?: string
  width: number
  height: number
  valueFormatter: (value: number, isYAxis?: boolean) => string
  dateFormatterAxis: (dateStr: string) => string
  dateFormatterTooltip: (dateStr: string) => string
  showWatermark?: boolean
  filterZeroValues?: boolean // Example: for annualized revenue on MAX period
  timePeriod?: string // Added to trigger animations when timePeriod changes
  isLoading?: boolean // Added to control blur effect
}

export default function GenericAreaChart({
  data,
  color = "#20a67d", // Default color
  width,
  height,
  valueFormatter,
  dateFormatterAxis,
  dateFormatterTooltip,
  showWatermark = true,
  filterZeroValues = false,
  timePeriod,
  isLoading = false,
}: GenericAreaChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, value: 0, date: "" })

  const chartData = useMemo(() => {
    if (!data || width === 0 || height === 0) {
      return {
        points: [],
        minValue: 0,
        maxValue: 0,
        pathData: "",
        areaPath: "",
        width: width || 800, // Fallback, though parent should provide valid dimensions
        height: height || 400,
        padding: { top: 30, right: 30, bottom: 50, left: 60 },
        isNarrow: (width || 800) < 600,
        isMobile: (width || 800) < 400,
      }
    }

    let processedData = data
    if (filterZeroValues) {
      processedData = data.filter((d) => d.value > 0)
    }

    if (processedData.length === 0) {
      // Handle case where filtering results in empty data
      return {
        points: [],
        minValue: 0,
        maxValue: 0,
        pathData: "",
        areaPath: "",
        width: width,
        height: height,
        padding: { top: 30, right: width < 600 ? 20 : 30, bottom: width < 600 ? 40 : 50, left: width < 600 ? 50 : 60 },
        isNarrow: width < 600,
        isMobile: width < 400,
      }
    }

    const values = processedData.map((d) => d.value)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)

    const range = dataMax - dataMin
    const paddingValue = range === 0 ? dataMax * 0.1 : Math.max(range * 0.05, dataMax * 0.01) // Handle flat line
    let minValue = dataMin - paddingValue
    const maxValue = dataMax + paddingValue

    if (dataMin >= 0 && minValue < 0) {
      minValue = 0
    }

    const finalRange = maxValue - minValue === 0 ? 1 : maxValue - minValue // Avoid division by zero for flat lines

    const isNarrow = width < 600
    const isMobile = width < 400
    const padding = {
      top: 30,
      right: isNarrow ? 20 : 30,
      bottom: isNarrow ? 40 : 50,
      left: isNarrow ? 50 : 60,
    }

    const points = processedData.map((d, i) => ({
      x: padding.left + (i / (processedData.length - 1)) * (width - padding.left - padding.right),
      y: height - padding.bottom - ((d.value - minValue) / finalRange) * (height - padding.top - padding.bottom),
      value: d.value,
      date: d.date,
      index: i,
    }))

    const pathData = points.reduce((path, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`
      return `${path} L ${point.x} ${point.y}`
    }, "")

    const areaPath =
      points.length > 0
        ? `${pathData} L ${points[points.length - 1]?.x} ${height - padding.bottom} L ${points[0]?.x} ${height - padding.bottom} Z`
        : ""

    return {
      points,
      minValue,
      maxValue,
      width,
      height,
      pathData,
      areaPath,
      padding,
      isNarrow,
      isMobile,
    }
  }, [data, width, height, filterZeroValues])

  const yAxisLabels = useMemo(() => {
    if (!chartData || chartData.points.length === 0) return []

    const { minValue, maxValue, height, padding, isNarrow } = chartData
    const range = maxValue - minValue
    if (range === 0 && minValue === 0 && maxValue === 0) {
      // All data points are zero
      return [{ value: 0, y: height - padding.bottom, label: valueFormatter(0, true) }]
    }
    const steps = isNarrow ? 4 : 5
    const stepSize = range / steps

    const labels = []
    for (let i = 0; i <= steps; i++) {
      const currentValue = minValue + stepSize * i
      const y = height - padding.bottom - ((currentValue - minValue) / range) * (height - padding.top - padding.bottom)
      labels.push({
        value: currentValue,
        y,
        label: valueFormatter(currentValue, true),
      })
    }
    return labels
  }, [chartData, valueFormatter])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isLoading) return // Disable interactions during loading

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scaledMouseX = (mouseX / rect.width) * chartData.width
    const scaledMouseY = (mouseY / rect.height) * chartData.height

    if (
      scaledMouseX < chartData.padding.left ||
      scaledMouseX > chartData.width - chartData.padding.right ||
      chartData.points.length === 0
    ) {
      setTooltip({ ...tooltip, show: false })
      setHoveredPoint(null)
      return
    }

    const dataX = scaledMouseX - chartData.padding.left
    const chartWidthVal = chartData.width - chartData.padding.left - chartData.padding.right
    const dataIndex = Math.round((dataX / chartWidthVal) * (chartData.points.length - 1))
    const clampedIndex = Math.max(0, Math.min(chartData.points.length - 1, dataIndex))

    if (chartData.points[clampedIndex]) {
      const point = chartData.points[clampedIndex]
      setTooltip({
        show: true,
        x: point.x,
        y: scaledMouseY,
        value: point.value,
        date: point.date,
      })
      setHoveredPoint(clampedIndex)
    }
  }

  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (isLoading) return // Disable interactions during loading

    const touch = e.touches[0]
    if (!touch) return

    const rect = e.currentTarget.getBoundingClientRect()
    const touchX = touch.clientX - rect.left
    const touchY = touch.clientY - rect.top
    const scaledTouchX = (touchX / rect.width) * chartData.width
    const scaledTouchY = (touchY / rect.height) * chartData.height

    if (
      scaledTouchX < chartData.padding.left ||
      scaledTouchX > chartData.width - chartData.padding.right ||
      chartData.points.length === 0
    ) {
      setTooltip({ ...tooltip, show: false })
      setHoveredPoint(null)
      return
    }

    const dataX = scaledTouchX - chartData.padding.left
    const chartWidthVal = chartData.width - chartData.padding.left - chartData.padding.right
    const dataIndex = Math.round((dataX / chartWidthVal) * (chartData.points.length - 1))
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
  }

  const tooltipLeft = (tooltip.x / chartData.width) * 100
  const tooltipTop = (tooltip.y / chartData.height) * 100
  const isRightHalf = tooltip.x > chartData.width / 2
  const tooltipTransform = isRightHalf ? "translate(calc(-100% - 20px), -50%)" : "translate(20px, -50%)"

  const fontSize = chartData?.isNarrow ? "8px" : "10px"
  const strokeWidth = chartData?.isNarrow ? 2 : 3

  if (chartData.points.length === 0 && width > 0 && height > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
        No data available for this period.
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className={`overflow-visible cursor-crosshair transition-all duration-500 ${
          isLoading ? "blur-sm opacity-60" : "blur-0 opacity-100"
        }`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (!isLoading) {
            setTooltip({ ...tooltip, show: false })
            setHoveredPoint(null)
          }
        }}
        onTouchStart={(e) => {
          if (!isLoading) {
            e.preventDefault()
            handleTouch(e)
          }
        }}
        onTouchMove={(e) => {
          if (!isLoading) {
            e.preventDefault()
            handleTouch(e)
          }
        }}
        onTouchEnd={() => {
          if (!isLoading) {
            setTooltip({ ...tooltip, show: false })
            setHoveredPoint(null)
          }
        }}
      >
        <defs>
          <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="50%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {showWatermark && (
          <text
            x={chartData.width / 2}
            y={chartData.height * 0.2}
            textAnchor="middle"
            className="fill-white"
            style={{
              fontSize: "24px",
              fontWeight: "normal",
              opacity: "0.08",
              fontFamily: "Teodor, Arial, sans-serif",
              pointerEvents: "none",
            }}
          >
            <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>Hype</tspan>
            <tspan style={{ fontStyle: "italic", fontWeight: "300" }}>Screener</tspan>
            <tspan style={{ fontStyle: "normal", fontWeight: "normal" }}>.xyz</tspan>
          </text>
        )}

        <line
          x1={chartData.padding.left}
          y1={chartData.padding.top}
          x2={chartData.padding.left}
          y2={chartData.height - chartData.padding.bottom}
          stroke="#2d5a4f"
          strokeWidth="1"
        />
        <line
          x1={chartData.padding.left}
          y1={chartData.height - chartData.padding.bottom}
          x2={chartData.width - chartData.padding.right}
          y2={chartData.height - chartData.padding.bottom}
          stroke="#2d5a4f"
          strokeWidth="1"
        />

        {yAxisLabels.map((label, i) => (
          <g key={i}>
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

        {chartData.points.map((point, i) => {
          let showEvery = 1
          if (chartData.isMobile) {
            if (chartData.points.length > 30) showEvery = Math.ceil(chartData.points.length / 4)
            else if (chartData.points.length > 7) showEvery = Math.ceil(chartData.points.length / 3)
          } else if (chartData.isNarrow) {
            if (chartData.points.length > 90) showEvery = Math.ceil(chartData.points.length / 8)
            else if (chartData.points.length > 30) showEvery = Math.ceil(chartData.points.length / 6)
            else if (chartData.points.length > 7) showEvery = Math.ceil(chartData.points.length / 4)
            else showEvery = chartData.points.length > 1 ? 2 : 1
          } else {
            if (chartData.points.length > 90) showEvery = Math.ceil(chartData.points.length / 10)
            else if (chartData.points.length > 30) showEvery = Math.ceil(chartData.points.length / 8)
            else if (chartData.points.length > 7) showEvery = Math.ceil(chartData.points.length / 6)
          }
          if (chartData.points.length === 1) showEvery = 1

          if (i !== 0 && i !== chartData.points.length - 1 && i % showEvery !== 0 && chartData.points.length > 1)
            return null

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
                {dateFormatterAxis(point.date)}
              </text>
            </g>
          )
        })}

        {chartData.areaPath && (
          <path
            d={chartData.areaPath}
            fill={`url(#gradient-${color.replace("#", "")})`}
            className="transition-all duration-500"
          />
        )}
        {chartData.pathData && (
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
        )}

        {tooltip.show &&
          !isLoading &&
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

        {tooltip.show && !isLoading && hoveredPoint !== null && chartData.points[hoveredPoint] && (
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

      {tooltip.show && !isLoading && (
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
          <div className="text-white font-bold text-base mb-1">{valueFormatter(tooltip.value, false)}</div>
          <div className="text-[#868d8f] text-xs">{dateFormatterTooltip(tooltip.date)}</div>
        </div>
      )}
    </div>
  )
}
