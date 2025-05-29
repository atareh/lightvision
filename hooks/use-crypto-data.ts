"use client"

import { useState, useEffect } from "react"

interface CryptoData {
  hype: {
    price: number
    market_cap: number
    percent_change_24h: number
    fully_diluted_market_cap: number
    volume_24h: number
    volume_change_24h: number
  }
}

export function useCryptoData() {
  const [data, setData] = useState<CryptoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/crypto-data")

        if (!response.ok) {
          throw new Error("Failed to fetch crypto data")
        }

        const result = await response.json()
        setData(result)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching crypto data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh data every 2 minutes (since data is cached on server)
    const interval = setInterval(fetchData, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
