"use client"

import { useState, useEffect } from "react"

interface HyperEVMProtocol {
  name: string
  dailyTvl: number
}

interface HyperEVMLlamaData {
  day: string
  totalDailyTvl: number
  protocols: HyperEVMProtocol[]
}

interface HyperEVMLlamaResponse {
  success: boolean
  data: HyperEVMLlamaData[]
  metadata?: {
    totalProtocolsFetched: number
    totalProtocolsAttempted: number
    totalEntries: number
    dedupedEntries: number
    daysWithData: number
    lastUpdated: string
  }
  error?: string
}

interface ProcessedHyperEVMData {
  current_tvl: number
  daily_change: number
  protocols: HyperEVMProtocol[]
  last_updated: string
  latest_day?: string
  previous_day?: string
  metadata?: any
  error?: string
}

export function useHyperEVMLlamaData() {
  const [data, setData] = useState<ProcessedHyperEVMData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/hyperevm-llama-tvl")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch HyperEVM Llama data`)
        }

        const result: HyperEVMLlamaResponse = await response.json()

        if (!result.success) {
          throw new Error(result.error || "API returned unsuccessful response")
        }

        if (!result.data || result.data.length === 0) {
          setData({
            current_tvl: 0,
            daily_change: 0,
            protocols: [],
            last_updated: new Date().toISOString(),
            error: "No data available from Llama API",
          })
          return
        }

        // Process the data to match the existing format
        const sortedDays = result.data.sort((a, b) => b.day.localeCompare(a.day))
        const latestDay = sortedDays[0]
        const previousDay = sortedDays.length > 1 ? sortedDays[1] : null

        const currentTVL = latestDay.totalDailyTvl
        const previousTVL = previousDay ? previousDay.totalDailyTvl : 0
        const dailyChange = currentTVL - previousTVL

        setData({
          current_tvl: currentTVL,
          daily_change: dailyChange,
          protocols: latestDay.protocols,
          last_updated: result.metadata?.lastUpdated || new Date().toISOString(),
          latest_day: latestDay.day,
          previous_day: previousDay?.day,
          metadata: result.metadata,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        console.error("Error fetching HyperEVM Llama data:", err)

        // Set default data to prevent UI crashes
        setData({
          current_tvl: 0,
          daily_change: 0,
          protocols: [],
          last_updated: new Date().toISOString(),
          error: errorMessage,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh every 6 hours as Llama data updates infrequently
    const interval = setInterval(fetchData, 6 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
