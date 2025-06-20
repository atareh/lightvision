"use client"

import { useState, useEffect } from "react"

interface MemesMetricsData {
  metrics: any[]
  marketCapChange: number | null
  volumeChange: number | null
  visibleMarketCapChange: number | null
  visibleVolumeChange: number | null
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
        // THIS IS THE FETCH CALL
        const response = await fetch("/api/memes-metrics") // Potential caching here

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        // Add debugging console log
        console.log("Memes Metrics API Response:", {
          visibleMarketCapChange: result.visibleMarketCapChange,
          visibleVolumeChange: result.visibleVolumeChange,
          marketCapChange: result.marketCapChange,
          volumeChange: result.volumeChange,
          latest: result.latest,
          oldest: result.oldest,
        })

        setData(result)
        setError(null)
      } catch (err) {
        console.error("Error fetching memes metrics:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch memes metrics")
      } finally {
        setLoading(false)
      }
    }

    fetchData() // Initial fetch

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000) // Subsequent fetches

    return () => clearInterval(interval)
  }, []) // Empty dependency array means this runs once on mount and sets up interval

  return { data, loading, error }
}
