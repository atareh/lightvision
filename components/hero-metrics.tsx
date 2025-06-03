"use client"
import { useState, useMemo, useRef, useEffect } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { MetricsCard } from "@/components/ui/metrics-card"
import { ChartHeader } from "@/components/ui/chart-header"
import GenericAreaChart, { type DataPoint } from "@/components/ui/generic-area-chart" // Import the new generic chart

import { useDuneData } from "@/hooks/use-dune-data"
import { useRevenueData } from "@/hooks/use-revenue-data"
import { formatTVL, formatNetflow, formatWallets, formatRevenue } from "@/lib/utils"

export default function HeroMetrics() {
  const { data: duneData, loading: duneLoading } = useDuneData()
  const { data: revenueData, loading: revenueLoading } = useRevenueData()

  // Debug logging
  useEffect(() => {
    console.log("Revenue data:", revenueData)
    console.log("Dune data:", duneData)
  }, [revenueData, duneData])

  const [activeMetric, setActiveMetric] = useState<"tvl" | "dailyRevenue" | "annualizedRevenue" | "wallets">("tvl")
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 }) // Initialize with 0
  const [timePeriod, setTimePeriod] = useState<"7D" | "30D" | "90D" | "MAX">("7D")

  const graphDataFallback = useMemo(
    () => ({
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
        { date: "2025-05-04", value: 503000 }, // Corrected date from 04-04
        { date: "2025-05-05", value: 503463 },
      ],
    }),
    [],
  )

  const [historicalData, setHistoricalData] = useState<{
    tvl: DataPoint[]
    dailyRevenue: DataPoint[]
    annualizedRevenue: DataPoint[]
    wallets: DataPoint[]
  }>({
    tvl: graphDataFallback.tvl,
    dailyRevenue: graphDataFallback.dailyRevenue,
    annualizedRevenue: graphDataFallback.annualizedRevenue,
    wallets: graphDataFallback.wallets,
  })
  const [loadingHistorical, setLoadingHistorical] = useState(false)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect()
        setChartDimensions({ width, height })
      }
    }
    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(chartContainerRef.current)
    return () => {
      if (chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoadingHistorical(true)
      try {
        const timestamp = Date.now()
        const [duneHistoricalRes, revenueHistoricalRes] = await Promise.all([
          fetch(`/api/dune-data?period=${timePeriod.toLowerCase()}&_t=${timestamp}`),
          fetch(`/api/revenue-data?period=${timePeriod.toLowerCase()}&_t=${timestamp}`),
        ])

        if (!duneHistoricalRes.ok || !revenueHistoricalRes.ok) {
          console.error("Failed to fetch historical data", {
            duneStatus: duneHistoricalRes.status,
            revenueStatus: revenueHistoricalRes.status,
          })
          // Fallback to static data on API error
          setHistoricalData({
            tvl: graphDataFallback.tvl,
            dailyRevenue: graphDataFallback.dailyRevenue,
            annualizedRevenue: graphDataFallback.annualizedRevenue,
            wallets: graphDataFallback.wallets,
          })
          return
        }

        const duneHistorical = await duneHistoricalRes.json()
        const revenueHistorical = await revenueHistoricalRes.json()

        setHistoricalData({
          tvl: duneHistorical.historical_tvl || graphDataFallback.tvl,
          dailyRevenue: revenueHistorical.historical_daily_revenue || graphDataFallback.dailyRevenue,
          annualizedRevenue: revenueHistorical.historical_annualized_revenue || graphDataFallback.annualizedRevenue,
          wallets: duneHistorical.historical_wallets || graphDataFallback.wallets,
        })
      } catch (error) {
        console.error("Error fetching historical data:", error)
        setHistoricalData(graphDataFallback) // Fallback to static data on any error
      } finally {
        setLoadingHistorical(false)
      }
    }
    fetchHistoricalData()
  }, [timePeriod, graphDataFallback])

  // Separate calculation for annualized revenue change to avoid affecting other metrics
  const annualizedRevenueChange = useMemo(() => {
    if (revenueLoading) return ""

    const data = historicalData.annualizedRevenue
    if (data.length >= 2) {
      const today = data[data.length - 1]?.value
      const yesterday = data[data.length - 2]?.value
      if (typeof today === "number" && typeof yesterday === "number") {
        const diff = today - yesterday
        return `${diff >= 0 ? "+" : "-"}${formatTVL(Math.abs(diff))} 24h`
      }
    }
    return ""
  }, [historicalData.annualizedRevenue, revenueLoading])

  const annualizedRevenueIsPositive = useMemo(() => {
    const data = historicalData.annualizedRevenue
    if (data.length >= 2) {
      const today = data[data.length - 1]?.value
      const yesterday = data[data.length - 2]?.value
      if (typeof today === "number" && typeof yesterday === "number") return today >= yesterday
    }
    return true
  }, [historicalData.annualizedRevenue])

  const metricsConfig = useMemo(
    () => ({
      tvl: {
        title: "USDC Bridged",
        value: duneLoading ? (
          <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
        ) : duneData ? (
          formatTVL(duneData.tvl)
        ) : (
          "TO DO"
        ),
        change: duneLoading
          ? ""
          : duneData && typeof duneData.netflow === "number"
            ? `${formatNetflow(duneData.netflow)} 24h`
            : "",
        isPositive: duneData ? duneData.netflow >= 0 : true,
        isLoading: duneLoading,
        color: "#20a67d",
        dataKey: "tvl",
      },
      dailyRevenue: {
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
          : revenueData &&
              typeof revenueData.daily_revenue === "number" &&
              typeof revenueData.previous_day_revenue === "number"
            ? (() => {
                const dailyDiff = revenueData.daily_revenue - revenueData.previous_day_revenue
                return `${dailyDiff >= 0 ? "+" : "-"}${formatRevenue(Math.abs(dailyDiff))} 24h`
              })()
            : "",
        isPositive:
          revenueData && revenueData.previous_day_revenue
            ? revenueData.daily_revenue >= revenueData.previous_day_revenue
            : true,
        isLoading: revenueLoading,
        color: "#4f9eff",
        dataKey: "dailyRevenue",
      },
      annualizedRevenue: {
        title: "Annualized Revenue",
        value: revenueLoading ? (
          <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
        ) : revenueData && revenueData.annualized_revenue > 0 ? (
          formatTVL(revenueData.annualized_revenue)
        ) : (
          "TO DO"
        ),
        change: annualizedRevenueChange,
        isPositive: annualizedRevenueIsPositive,
        isLoading: revenueLoading,
        color: "#ff8c42",
        dataKey: "annualizedRevenue",
      },
      wallets: {
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
          : duneData && typeof duneData.address_count === "number" && duneData.address_count >= 0
            ? `+${formatWallets(duneData.address_count, "0")} today`
            : "",
        isPositive: true,
        isLoading: duneLoading,
        color: "#8b5cf6",
        dataKey: "wallets",
      },
    }),
    [duneData, revenueData, duneLoading, revenueLoading, annualizedRevenueChange, annualizedRevenueIsPositive],
  )

  const currentMetricConfig = metricsConfig[activeMetric]
  const chartDataForMetric = historicalData[activeMetric] || graphDataFallback[activeMetric]

  const valueFormatterForMetric = (value: number, isYAxis?: boolean) => {
    if (activeMetric === "wallets") {
      if (isYAxis) {
        if (value >= 1e6) return `${Math.round(value / 1e6)}M`
        else if (value >= 1e3) return `${Math.round(value / 1e3)}K`
        return Math.round(value).toString()
      }
      return value.toLocaleString()
    }
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 10e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return isYAxis ? `$${Math.round(value / 1e3)}K` : `$${(value / 1e3).toFixed(1)}K`
    return `$${Math.round(value)}`
  }

  const dateFormatterAxis = (dateStr: string) => {
    if (!dateStr) return "Invalid"
    try {
      const date = new Date(dateStr + "T12:00:00Z") // Assume UTC date part
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    } catch (e) {
      return "Invalid"
    }
  }

  const dateFormatterTooltip = (dateStr: string) => {
    if (!dateStr) return "Invalid Date"
    try {
      const date = new Date(dateStr + "T12:00:00Z") // Assume UTC date part
      return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    } catch (e) {
      return "Invalid Date"
    }
  }

  const getGraphTitle = () => {
    const metric = metricsConfig[activeMetric]
    if (!metric) return ""
    if (chartDimensions.width < 400) {
      // Abbreviated titles for mobile
      switch (metric.dataKey) {
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

  const filterZeroValuesForChart = activeMetric === "annualizedRevenue" && timePeriod === "MAX"

  return (
    <div className="flex flex-col lg:flex-row mt-8 gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-[200px] lg:h-[528px] lg:gap-0">
        {(Object.keys(metricsConfig) as Array<keyof typeof metricsConfig>).map((metricId) => {
          const metric = metricsConfig[metricId]

          // Get the appropriate lastUpdatedAt value
          const getLastUpdatedAt = () => {
            if (metricId === "tvl" || metricId === "wallets") {
              return duneData?.last_updated
            } else {
              // For revenue metrics, use a fallback if last_updated_at doesn't exist
              return revenueData?.last_updated_at || revenueData?.last_updated || new Date().toISOString()
            }
          }

          return (
            <MetricsCard
              key={metricId}
              title={metric.title}
              value={metric.value}
              change={metric.change}
              isPositive={metric.isPositive}
              isLoading={metric.isLoading}
              active={activeMetric === metricId}
              onClick={() => setActiveMetric(metricId)}
              color={metric.color}
              // Add refresh indicator props
              updateFrequencyHours={metricId === "tvl" || metricId === "wallets" ? 4 : 24}
              lastUpdatedAt={getLastUpdatedAt()}
              isRealtime={false}
              showChangeArrow={true}
            />
          )
        })}
      </div>

      <div className="flex-1 min-w-0">
        <Card className="bg-[#062722] rounded-[10px] shadow-xl drop-shadow-lg overflow-hidden border-0 h-[528px] flex flex-col">
          <ChartHeader title={getGraphTitle()} timeRange={timePeriod} setTimeRange={setTimePeriod} />
          <CardContent className="bg-[#0f1a1f] p-0 flex-1 overflow-hidden relative">
            <div ref={chartContainerRef} className="w-full h-full">
              {chartDimensions.width > 0 && chartDimensions.height > 0 ? (
                <>
                  <GenericAreaChart
                    data={chartDataForMetric}
                    color={currentMetricConfig.color}
                    width={chartDimensions.width}
                    height={chartDimensions.height}
                    valueFormatter={valueFormatterForMetric}
                    dateFormatterAxis={dateFormatterAxis}
                    dateFormatterTooltip={dateFormatterTooltip}
                    filterZeroValues={filterZeroValuesForChart}
                    showWatermark={true}
                    timePeriod={timePeriod}
                    isLoading={loadingHistorical}
                  />
                  {loadingHistorical && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center">
                        <div className="text-lg font-bold mb-2 text-center text-white/80">
                          <span className="font-normal" style={{ fontFamily: "Teodor, Arial, sans-serif" }}>
                            Hype
                          </span>
                          <span className="font-light italic" style={{ fontFamily: "Teodor, Arial, sans-serif" }}>
                            Screener
                          </span>
                          <span className="font-normal" style={{ fontFamily: "Teodor, Arial, sans-serif" }}>
                            .xyz
                          </span>
                        </div>
                        <div className="animate-pulse bg-white/20 rounded w-16 h-0.5"></div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  Loading chart...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
