"use client"

import { useState, useEffect } from "react"

interface HyperEVMProtocol {
  name: string
  tvl: number
}

interface HyperEVMData {
  current_tvl: number
  daily_change: number
  protocols: HyperEVMProtocol[]
  last_updated: string
  latest_day?: string
  error?: string
}

export function useHyperEVMData() {
  const [data, setData] = useState<HyperEVMData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Add cache-busting parameter
        const response = await fetch(`/api/hyperevm-tvl?_t=${Date.now()}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch HyperEVM data`)
        }

        const result = await response.json()

        // Check if the API returned an error message but still has data structure
        if (result.error) {
          setError(result.error)
          // Still set the data even if there's an error message
          setData({
            current_tvl: result.current_tvl || 0,
            daily_change: result.daily_change || 0,
            protocols: result.protocols || [],
            last_updated: result.last_updated || new Date().toISOString(),
            error: result.error,
          })
        } else {
          setData(result)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        console.error("Error fetching HyperEVM data:", err)

        // Set default data to prevent UI crashes
        setData({
          current_tvl: 0,
          daily_change: 0,
          protocols: [],
          last_updated: new Date().toISOString(),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Add periodic refresh every 2 minutes
    const interval = setInterval(fetchData, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
