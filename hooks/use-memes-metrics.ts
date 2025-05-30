"use client"

import { useState, useEffect } from "react"

interface MemesMetricsData {
  metrics: any[]
  marketCapChange: number | null
  volumeChange: number | null
  oldest?: any
  latest?: any
}

export function useMemesMetrics() {
  const [data, setData] = useState<MemesMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/memes-metrics")

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        setData(result)
        setError(null)
      } catch (err) {
        console.error("Error fetching memes metrics:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch memes metrics")
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
