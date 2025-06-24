"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DebugSyncRevenuePage() {
  const [password, setPassword] = useState("")
  const [syncResult, setSyncResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const triggerManualSync = async () => {
    if (!password) {
      setError("Password required")
      return
    }

    setLoading(true)
    setError(null)
    setSyncResult(null)

    try {
      console.log("Triggering manual revenue sync...")
      const response = await fetch("/api/manual-revenue-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()
      console.log("Manual sync response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync revenue data")
      }

      setSyncResult(data)
    } catch (err) {
      console.error("Sync error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const checkCurrentData = async () => {
    try {
      console.log("Checking current revenue data...")
      const response = await fetch(`/api/revenue-data?_t=${Date.now()}`)
      const data = await response.json()
      console.log("Current revenue data:", data)

      // Display in UI
      setSyncResult({
        ...syncResult,
        current_data: data,
      })
    } catch (err) {
      console.error("Error checking current data:", err)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Revenue Sync Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Debug password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && triggerManualSync()}
            />
            <Button onClick={triggerManualSync} disabled={loading}>
              {loading ? "Syncing..." : "Manual Sync"}
            </Button>
            <Button onClick={checkCurrentData} variant="outline">
              Check Current Data
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {syncResult && (
            <div className="space-y-4">
              {syncResult.success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
                  <h3 className="font-bold mb-2">Sync Successful!</h3>
                  <p>Inserted: {syncResult.inserted || 0}</p>
                  <p>Updated: {syncResult.updated || 0}</p>
                  {syncResult.latest_day && <p>Latest Day: {syncResult.latest_day}</p>}
                  {syncResult.latest_revenue && <p>Latest Revenue: ${syncResult.latest_revenue?.toLocaleString()}</p>}
                  {syncResult.latest_annualized && <p>Annualized: ${syncResult.latest_annualized?.toLocaleString()}</p>}
                  <p>Execution ID: {syncResult.execution_id}</p>
                </div>
              )}

              {syncResult.current_data && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <h3 className="font-bold mb-2">Current API Data</h3>
                  <pre className="text-xs overflow-auto max-h-64">
                    {JSON.stringify(syncResult.current_data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                <h3 className="font-bold mb-2">Full Sync Response</h3>
                <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(syncResult, null, 2)}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Enter your debug password</li>
            <li>Click "Manual Sync" to trigger the revenue data sync from DeFiLlama</li>
            <li>Wait for the sync to complete (should take 10-30 seconds)</li>
            <li>Click "Check Current Data" to see if the API now returns data</li>
            <li>Check the browser console for detailed logs</li>
            <li>Go back to the main dashboard to see if metrics are working</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
