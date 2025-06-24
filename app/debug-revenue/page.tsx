"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DebugRevenuePage() {
  const [password, setPassword] = useState("")
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDebugData = async () => {
    if (!password) {
      setError("Password required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/debug-revenue-data?password=${encodeURIComponent(password)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch debug data")
      }

      setDebugData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Revenue Data Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Debug password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchDebugData()}
            />
            <Button onClick={fetchDebugData} disabled={loading}>
              {loading ? "Loading..." : "Fetch Debug Data"}
            </Button>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">Error: {error}</div>}

          {debugData && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-bold mb-2">Database Summary</h3>
                <p>Total Records: {debugData.debug_info.total_records}</p>
                <p>Table Columns: {debugData.debug_info.table_structure.join(", ")}</p>
              </div>

              {debugData.debug_info.errors.revenue_error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <h3 className="font-bold mb-2">Database Errors</h3>
                  <p>{debugData.debug_info.errors.revenue_error}</p>
                </div>
              )}

              <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                <h3 className="font-bold mb-2">Latest 10 Records</h3>
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(debugData.debug_info.latest_10_records, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
