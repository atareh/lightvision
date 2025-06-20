"use client"

import { useState, useEffect } from "react"

export default function DebugMemesDataPage() {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/debug-memes-table")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch debug data")
        }

        setDebugData(data)
        console.log("Debug memes table data:", data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        console.error("Error fetching debug data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDebugData()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Memes Data</h1>
        <p>Loading debug data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Memes Data</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Memes Data</h1>

      {debugData?.summary && (
        <div className="mb-6 bg-blue-50 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <ul className="space-y-1">
            <li>
              <strong>Total Records:</strong> {debugData.summary.totalRecords}
            </li>
            <li>
              <strong>Records Returned:</strong> {debugData.summary.recordsReturned}
            </li>
            <li>
              <strong>Has Visible Data:</strong> {debugData.summary.hasVisibleData ? "Yes" : "No"}
            </li>
            <li>
              <strong>Timestamp:</strong> {debugData.summary.timestamp}
            </li>
          </ul>

          {debugData.summary.latestRecord && (
            <div className="mt-3">
              <strong>Latest Record:</strong>
              <div className="ml-4 text-sm">
                <div>ID: {debugData.summary.latestRecord.id}</div>
                <div>Recorded At: {debugData.summary.latestRecord.recorded_at}</div>
                <div>Total Market Cap: {debugData.summary.latestRecord.total_market_cap}</div>
                <div>Visible Market Cap: {debugData.summary.latestRecord.visible_market_cap || "null"}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Raw Debug Data (for copying)</h2>
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </div>

      {debugData?.records && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Recent Records</h2>
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
                {debugData.records.slice(0, 10).map((record: any, index: number) => (
                  <tr key={record.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
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
