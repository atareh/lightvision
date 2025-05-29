"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

export default function TestRevenueMigrationPage() {
  const [llamaDirectData, setLlamaDirectData] = useState<any>(null)
  const [databaseData, setDatabaseData] = useState<any>(null)
  const [loading, setLoading] = useState<{ llamaDirect: boolean; database: boolean }>({
    llamaDirect: false,
    database: false,
  })
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [password, setPassword] = useState("")

  // Fetch directly from Llama API
  const fetchLlamaDirectData = async () => {
    try {
      setLoading((prev) => ({ ...prev, llamaDirect: true }))
      const response = await fetch("/api/hyperliquid-llama-revenue")
      const result = await response.json()
      setLlamaDirectData(result)
    } catch (err) {
      console.error("Error fetching direct Llama data:", err)
    } finally {
      setLoading((prev) => ({ ...prev, llamaDirect: false }))
    }
  }

  // Fetch from database
  const fetchDatabaseData = async () => {
    try {
      setLoading((prev) => ({ ...prev, database: true }))
      const response = await fetch("/api/revenue-data")
      const result = await response.json()
      setDatabaseData(result)
    } catch (err) {
      console.error("Error fetching database data:", err)
    } finally {
      setLoading((prev) => ({ ...prev, database: false }))
    }
  }

  const triggerSync = async () => {
    try {
      setSyncLoading(true)
      const response = await fetch("/api/manual-revenue-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      setSyncResult(result)

      // Refresh database data after sync
      if (result.success) {
        await fetchDatabaseData()
      }
    } catch (err) {
      console.error("Error triggering sync:", err)
      setSyncResult({ success: false, error: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => {
    fetchLlamaDirectData()
    fetchDatabaseData()
  }, [])

  const formatRevenue = (revenue: number): string => {
    if (revenue >= 1e6) return `$${(revenue / 1e6).toFixed(2)}M`
    if (revenue >= 1e3) return `$${(revenue / 1e3).toFixed(2)}K`
    return `$${revenue.toFixed(2)}`
  }

  const renderDataCard = (title: string, data: any, isLoading: boolean, onRefresh: () => void) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : data?.error ? (
          <div className="p-4 bg-red-100 rounded">
            <p className="text-red-600">{data.error}</p>
          </div>
        ) : data ? (
          <div>
            {title === "Llama API (Direct)" ? (
              // Llama direct data format
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Latest Day</p>
                  <p className="text-lg font-semibold">{data.data?.[0]?.day || "N/A"}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Daily Revenue</p>
                  <p className="text-2xl font-bold">{formatRevenue(data.data?.[0]?.revenue || 0)}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Annualized Revenue</p>
                  <p className="text-xl font-semibold">{formatRevenue(data.data?.[0]?.annualized_revenue || 0)}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Data Source</p>
                  <p className="text-sm font-mono">{data.source || "unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Recent Days</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(data.data || []).slice(0, 7).map((day: any) => (
                      <div key={day.day} className="flex justify-between items-center">
                        <span className="text-sm">{day.day}</span>
                        <span className="font-mono text-sm">{formatRevenue(day.revenue || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Database data format
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Latest Day</p>
                  <p className="text-lg font-semibold">{data.latest_day || "N/A"}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Daily Revenue</p>
                  <p className="text-2xl font-bold">{formatRevenue(data.daily_revenue || 0)}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Annualized Revenue</p>
                  <p className="text-xl font-semibold">{formatRevenue(data.annualized_revenue || 0)}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Daily Change</p>
                  <p
                    className={`text-lg font-semibold ${
                      (data.daily_change || 0) >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {(data.daily_change || 0) >= 0 ? "+" : ""}
                    {formatRevenue(data.daily_change || 0)}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p>No data available</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Revenue Data Migration Test</h1>

      <div className="p-4 bg-blue-100 rounded">
        <p className="text-blue-800">
          <strong>Note:</strong> This page compares revenue data from different sources:
        </p>
        <ul className="list-disc list-inside mt-2 text-blue-700">
          <li>
            <strong>Llama API (Direct):</strong> Fresh data directly from Llama API
          </li>
          <li>
            <strong>Database (Current):</strong> What's currently in your database
          </li>
        </ul>
      </div>

      {/* Sync Control */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Sync Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Debug Password"
                className="px-3 py-2 border rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={triggerSync} disabled={syncLoading || !password}>
                {syncLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Trigger Revenue Sync
              </Button>
            </div>

            {syncResult && (
              <div className={`p-4 rounded ${syncResult.success ? "bg-green-100" : "bg-red-100"}`}>
                {syncResult.success ? (
                  <div>
                    <p>Successfully synced {syncResult.inserted} records</p>
                    <p>Latest Day: {syncResult.latest_day}</p>
                    <p>Latest Revenue: {formatRevenue(syncResult.latest_revenue)}</p>
                    <p>Latest Annualized: {formatRevenue(syncResult.latest_annualized)}</p>
                  </div>
                ) : (
                  <p>Error: {syncResult.error}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderDataCard("Llama API (Direct)", llamaDirectData, loading.llamaDirect, fetchLlamaDirectData)}
        {renderDataCard("Database (Current)", databaseData, loading.database, fetchDatabaseData)}
      </div>

      {/* Comparison Summary */}
      {llamaDirectData?.data?.[0] && databaseData && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Metric</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Llama Direct</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Database</p>
                </div>

                <div>
                  <p className="font-medium">Daily Revenue</p>
                </div>
                <div>
                  <p>{formatRevenue(llamaDirectData.data[0].revenue || 0)}</p>
                </div>
                <div>
                  <p>{formatRevenue(databaseData.daily_revenue || 0)}</p>
                </div>

                <div>
                  <p className="font-medium">Annualized Revenue</p>
                </div>
                <div>
                  <p>{formatRevenue(llamaDirectData.data[0].annualized_revenue || 0)}</p>
                </div>
                <div>
                  <p>{formatRevenue(databaseData.annualized_revenue || 0)}</p>
                </div>

                <div>
                  <p className="font-medium">Latest Day</p>
                </div>
                <div>
                  <p>{llamaDirectData.data[0].day || "N/A"}</p>
                </div>
                <div>
                  <p>{databaseData.latest_day || "N/A"}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-100 rounded">
                <p className="font-medium mb-2">Status</p>
                {Math.abs((llamaDirectData.data[0].revenue || 0) - (databaseData.daily_revenue || 0)) < 0.01 ? (
                  <p className="text-green-600">✅ Revenue values match! Migration appears successful.</p>
                ) : (
                  <p className="text-red-600">❌ Revenue values don't match. Sync may be needed.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
