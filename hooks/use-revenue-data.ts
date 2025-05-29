"use client"

import { useState, useEffect } from "react"

interface RevenueData {
  daily_revenue: number
  daily_change: number
  annualized_revenue: number
  last_updated: string
  latest_day?: string
  previous_day?: string
  error?: string
}

export function useRevenueData() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/revenue-data")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch revenue data`)
        }

        const result = await response.json()

        if (result.error) {
          setError(result.error)
          // Still set the data even if there's an error message
          setData({
            daily_revenue: result.daily_revenue || 0,
            daily_change: result.daily_change || 0,
            annualized_revenue: result.annualized_revenue || 0,
            last_updated: result.last_updated || new Date().toISOString(),
            latest_day: result.latest_day,
            previous_day: result.previous_day,
            error: result.error,
          })
        } else {
          setData(result)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        console.error("Error fetching revenue data:", err)

        // Set default data to prevent UI crashes
        setData({
          daily_revenue: 0,
          daily_change: 0,
          annualized_revenue: 0,
          last_updated: new Date().toISOString(),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // No auto-refresh interval - data is updated daily via cron job
  }, [])

  return { data, loading, error }
}
