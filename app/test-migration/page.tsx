"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

export default function TestMigrationPage() {
  const [duneHyperEVMData, setDuneHyperEVMData] = useState<any>(null)
  const [llamaData, setLlamaData] = useState<any>(null)
  const [llamaDirectData, setLlamaDirectData] = useState<any>(null)
  const [loading, setLoading] = useState<{ dune: boolean; llama: boolean; llamaDirect: boolean }>({
    dune: false,
    llama: false,
    llamaDirect: false,
  })
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [password, setPassword] = useState("")

  // This should fetch the OLD Dune-based HyperEVM data
  const fetchDuneHyperEVMData = async () => {
    try {
      setLoading((prev) => ({ ...prev, dune: true }))
      // We need to check what endpoint was originally used for Dune HyperEVM data
      // For now, let's try the hyperevm-tvl endpoint but with a flag to use old data
      const response = await fetch("/api/hyperevm-tvl")
      const result = await response.json()

      // Check if this data has execution_id (indicating it's from Dune)
      if (result.debug_info) {
        setDuneHyperEVMData(result)
      } else {
        // If no debug info, this might be the new Llama data
        setDuneHyperEVMData({ error: "No Dune HyperEVM data found - this might already be Llama data" })
      }
    } catch (err) {
      console.error("Error fetching Dune HyperEVM data:", err)
      setDuneHyperEVMData({ error: "Failed to fetch Dune HyperEVM data" })
    } finally {
      setLoading((prev) => ({ ...prev, dune: false }))
    }
  }

  // This fetches from the database (after Llama sync)
  const fetchLlamaData = async () => {
    try {
      setLoading((prev) => ({ ...prev, llama: true }))
      const response = await fetch("/api/hyperevm-tvl")
      const result = await response.json()
      setLlamaData(result)
    } catch (err) {
      console.error("Error fetching Llama data:", err)
    } finally {
      setLoading((prev) => ({ ...prev, llama: false }))
    }
  }

  // This fetches directly from Llama API (for comparison)
  const fetchLlamaDirectData = async () => {
    try {
      setLoading((prev) => ({ ...prev, llamaDirect: true }))
      const response = await fetch("/api/hyperevm-llama-tvl")
      const result = await response.json()

      if (result.success && result.data && result.data.length > 0) {
        // Transform to match the expected format
        const latestDay = result.data[0]
        const previousDay = result.data.length > 1 ? result.data[1] : null

        const transformed = {
          current_tvl: latestDay.totalDailyTvl,
          daily_change: previousDay ? latestDay.totalDailyTvl - previousDay.totalDailyTvl : 0,
          protocols: latestDay.protocols,
          latest_day: latestDay.day,
          previous_day: previousDay?.day,
          data_source: "llama_api_direct",
        }
        setLlamaDirectData(transformed)
      } else {
        setLlamaDirectData({ error: "Failed to fetch direct Llama data" })
      }
    } catch (err) {
      console.error("Error fetching direct Llama data:", err)
    } finally {
      setLoading((prev) => ({ ...prev, llamaDirect: false }))
    }
  }

  const triggerSync = async () => {
    try {
      setSyncLoading(true)
      const response = await fetch("/api/manual-hyperevm-llama-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      setSyncResult(result)

      // Refresh Llama data after sync
      if (result.success) {
        await fetchLlamaData()
      }
    } catch (err) {
      console.error("Error triggering sync:", err)
      setSyncResult({ success: false, error: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => {
    fetchDuneHyperEVMData()
    fetchLlamaData()
    fetchLlamaDirectData()
  }, [])

  const formatTVL = (tvl: number): string => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`
    return `$${tvl.toFixed(2)}`
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
            <div className="mb-4">
              <p className="text-sm text-gray-500">Total TVL</p>
              <p className="text-2xl font-bold">{formatTVL(data.current_tvl || 0)}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">Daily Change</p>
              <p
                className={`text-lg font-semibold ${(data.daily_change || 0) >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {(data.daily_change || 0) >= 0 ? "+" : ""}
                {formatTVL(data.daily_change || 0)}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">Data Source</p>
              <p className="text-sm font-mono">{data.data_source || "unknown"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">
                Protocol Breakdown ({(data.protocols || []).length} protocols)
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(data.protocols || []).map((protocol: any) => (
                  <div key={protocol.name} className="flex justify-between items-center">
                    <span className="text-sm">{protocol.name}</span>
                    <span className="font-mono text-sm">{formatTVL(protocol.tvl || protocol.dailyTvl || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p>No data available</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">HyperEVM TVL Migration Test</h1>

      <div className="p-4 bg-blue-100 rounded">
        <p className="text-blue-800">
          <strong>Note:</strong> This page compares HyperEVM TVL data from different sources:
        </p>
        <ul className="list-disc list-inside mt-2 text-blue-700">
          <li>
            <strong>Database (Current):</strong> What's currently in your database (could be Dune or Llama)
          </li>
          <li>
            <strong>Llama API (Direct):</strong> Fresh data directly from Llama API
          </li>
          <li>
            <strong>After Sync:</strong> Database data after running the Llama sync
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
                Trigger Llama Sync
              </Button>
            </div>

            {syncResult && (
              <div className={`p-4 rounded ${syncResult.success ? "bg-green-100" : "bg-red-100"}`}>
                {syncResult.success ? (
                  <div>
                    <p>
                      Successfully synced {syncResult.upserted} records for {syncResult.day}
                    </p>
                    <p>Total TVL: {formatTVL(syncResult.totalTVL)}</p>
                  </div>
                ) : (
                  <p>Error: {syncResult.error}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Database */}
      <Card>
        <CardHeader>
          <CardTitle>Database Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              try {
                const response = await fetch("/api/debug-hyperevm-db")
                const result = await response.json()
                console.log("Database debug:", result)
                alert(
                  `Database has ${result.total_records} records across ${result.unique_days} days. Check console for details.`,
                )
              } catch (err) {
                console.error("Debug error:", err)
              }
            }}
          >
            Debug Database Contents
          </Button>
        </CardContent>
      </Card>

      {/* Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderDataCard("Database (Current)", duneHyperEVMData, loading.dune, fetchDuneHyperEVMData)}
        {renderDataCard("Llama API (Direct)", llamaDirectData, loading.llamaDirect, fetchLlamaDirectData)}
      </div>

      {/* After sync comparison */}
      <div className="grid grid-cols-1 gap-6">
        {renderDataCard("Database (After Sync)", llamaData, loading.llama, fetchLlamaData)}
      </div>

      {/* Comparison Summary */}
      {llamaDirectData && llamaData && (
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
                  <p className="font-medium">Total TVL</p>
                </div>
                <div>
                  <p>{formatTVL(llamaDirectData.current_tvl || 0)}</p>
                </div>
                <div>
                  <p>{formatTVL(llamaData.current_tvl || 0)}</p>
                </div>

                <div>
                  <p className="font-medium">Protocol Count</p>
                </div>
                <div>
                  <p>{(llamaDirectData.protocols || []).length}</p>
                </div>
                <div>
                  <p>{(llamaData.protocols || []).length}</p>
                </div>

                <div>
                  <p className="font-medium">Latest Day</p>
                </div>
                <div>
                  <p>{llamaDirectData.latest_day || "N/A"}</p>
                </div>
                <div>
                  <p>{llamaData.latest_day || "N/A"}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-100 rounded">
                <p className="font-medium mb-2">Status</p>
                {(llamaDirectData.protocols || []).length === (llamaData.protocols || []).length ? (
                  <p className="text-green-600">✅ Protocol counts match! Migration appears successful.</p>
                ) : (
                  <p className="text-red-600">❌ Protocol counts don't match. Sync may be needed.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
