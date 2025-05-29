"use client"

import { useState, useEffect } from "react"

interface DuneData {
  total_wallets: number
  tvl: number
  netflow: number
  daily_new_wallets: number
  wallet_growth: number
  tvl_change: number
  last_updated: string
  total_rows_in_db: number
  execution_id: string
  error?: string
}

export function useDuneData() {
  const [data, setData] = useState<DuneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/dune-data")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch Dune data`)
        }

        const result = await response.json()

        // Check if the API returned an error message
        if (result.error) {
          setError(result.error)
          // Still set the data with default values so the UI doesn't break
          setData({
            total_wallets: 0,
            tvl: 0,
            netflow: 0,
            daily_new_wallets: 0,
            wallet_growth: 0,
            tvl_change: 0,
            last_updated: new Date().toISOString(),
            total_rows_in_db: 0,
            execution_id: "no-data",
            error: result.error,
          })
        } else {
          setData(result)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        console.error("Error fetching Dune data:", err)

        // Set default data to prevent UI crashes
        setData({
          total_wallets: 0,
          tvl: 0,
          netflow: 0,
          daily_new_wallets: 0,
          wallet_growth: 0,
          tvl_change: 0,
          last_updated: new Date().toISOString(),
          total_rows_in_db: 0,
          execution_id: "error",
          error: errorMessage,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh data every 30 minutes
    const interval = setInterval(fetchData, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
