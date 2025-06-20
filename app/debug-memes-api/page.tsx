"use client"

import { useState, useEffect } from "react"

export default function DebugMemesApiPage() {
  const [apiData, setApiData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchApiData = async () => {
      try {
        setLoading(true)
        // This is the EXACT same call that useMemesMetrics makes
        const response = await fetch("/api/memes-metrics")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch API data")
        }

        setApiData(data)
        console.log("Memes metrics API data:", data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        console.error("Error fetching API data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchApiData()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Memes API</h1>
        <p>Loading API data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Memes API</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Memes API (/api/memes-metrics)</h1>

      <div className="mb-6 bg-blue-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Key Information</h2>
        <ul className="space-y-1">
          <li>
            <strong>Total Records:</strong> {apiData?.metrics?.length || 0}
          </li>
          <li>
            <strong>Latest Record Date:</strong> {apiData?.latest?.recorded_at || "N/A"}
          </li>
          <li>
            <strong>Latest Visible Market Cap:</strong> {apiData?.latest?.visible_market_cap || "null"}
          </li>
          <li>
            <strong>24h Ago Record Date:</strong> {apiData?.record24hAgo?.recorded_at || "N/A"}
          </li>
          <li>
            <strong>24h Ago Visible Market Cap:</strong> {apiData?.record24hAgo?.visible_market_cap || "null"}
          </li>
          <li>
            <strong>Visible Market Cap Change:</strong> {apiData?.visibleMarketCapChange || "null"}
          </li>
          <li>
            <strong>Visible Volume Change:</strong> {apiData?.visibleVolumeChange || "null"}
          </li>
        </ul>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Raw API Response (for copying)</h2>
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">{JSON.stringify(apiData, null, 2)}</pre>
      </div>

      {apiData?.metrics && (
        <div>
          <h2 className="text-lg font-semibold mb-2">First 10 Records from API</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 border text-left">Recorded At</th>
                  <th className="px-4 py-2 border text-left">Total Market Cap</th>
                  <th className="px-4 py-2 border text-left">Visible Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {apiData.metrics.slice(0, 10).map((record: any, index: number) => (
                  <tr key={record.id || index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-4 py-2 border text-sm">{record.recorded_at}</td>
                    <td className="px-4 py-2 border text-sm">{record.total_market_cap}</td>
                    <td className="px-4 py-2 border text-sm">{record.visible_market_cap || "null"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
