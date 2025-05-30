"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import DebugAuth from "@/components/debug-auth"

function DebugDataContent() {
  const [duneData, setDuneData] = useState(null)
  const [hyperevmData, setHyperevmData] = useState(null)
  const [revenueData, setRevenueData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const timestamp = Date.now()

      // Fetch all data sources with cache busting
      const [duneResponse, hyperevmResponse, revenueResponse] = await Promise.all([
        fetch(`/api/dune-data?_t=${timestamp}`),
        fetch(`/api/hyperevm-tvl?_t=${timestamp}`),
        fetch(`/api/revenue-data?_t=${timestamp}`),
      ])

      const duneResult = await duneResponse.json()
      const hyperevmResult = await hyperevmResponse.json()
      const revenueResult = await revenueResponse.json()

      setDuneData(duneResult)
      setHyperevmData(hyperevmResult)
      setRevenueData(revenueResult)
      setLastFetch(new Date().toISOString())
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoricalData = async () => {
    try {
      const timestamp = Date.now()

      // Fetch historical data for different periods
      const [dune7d, dune30d, duneMax] = await Promise.all([
        fetch(`/api/dune-data?period=7d&_t=${timestamp}`).then((r) => r.json()),
        fetch(`/api/dune-data?period=30d&_t=${timestamp}`).then((r) => r.json()),
        fetch(`/api/dune-data?period=max&_t=${timestamp}`).then((r) => r.json()),
      ])

      return { dune7d, dune30d, duneMax }
    } catch (error) {
      console.error("Error fetching historical data:", error)
      return null
    }
  }

  const [historicalData, setHistoricalData] = useState(null)

  useEffect(() => {
    fetchAllData()
    fetchHistoricalData().then(setHistoricalData)
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleString()
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return "N/A"
    if (typeof value === "number") {
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
      return `$${value.toFixed(2)}`
    }
    return String(value)
  }

  return (
    <div className="min-h-screen bg-[#0a1a1a] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Data Debug Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={fetchAllData} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh All Data"}
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Hard Refresh Page
            </Button>
          </div>
        </div>

        {lastFetch && <p className="text-sm text-gray-400">Last fetched: {formatDate(lastFetch)}</p>}

        {/* Current Date Check */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">Current Date & Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Client Time:</p>
                <p className="font-mono">{new Date().toISOString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Expected May 29 Date:</p>
                <p className="font-mono">2025-05-29</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dune Data Debug */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">Dune Data Debug</CardTitle>
          </CardHeader>
          <CardContent>
            {duneData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Total Wallets:</p>
                    <p className="font-mono">{duneData.total_wallets?.toLocaleString() || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">TVL:</p>
                    <p className="font-mono">{formatValue(duneData.tvl)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Last Updated:</p>
                    <p className="font-mono text-xs">{formatDate(duneData.last_updated)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Rows in DB:</p>
                    <p className="font-mono">{duneData.total_rows_in_db || "N/A"}</p>
                  </div>
                </div>

                {duneData.error && (
                  <div className="bg-red-900/20 border border-red-500 rounded p-3">
                    <p className="text-red-400 text-sm">Error: {duneData.error}</p>
                  </div>
                )}

                {/* Historical Data Check */}
                {historicalData?.duneMax?.historical_tvl && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Recent Historical TVL Data (Last 10 entries):</p>
                    <div className="bg-[#1a2e2a] rounded p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs font-mono">
                        {JSON.stringify(historicalData.duneMax.historical_tvl.slice(-10), null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Loading Dune data...</p>
            )}
          </CardContent>
        </Card>

        {/* HyperEVM Data Debug */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">HyperEVM Data Debug</CardTitle>
          </CardHeader>
          <CardContent>
            {hyperevmData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Current TVL:</p>
                    <p className="font-mono">{formatValue(hyperevmData.current_tvl)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Daily Change:</p>
                    <p className="font-mono">{formatValue(hyperevmData.daily_change)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Latest Day:</p>
                    <p className="font-mono">{hyperevmData.latest_day || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Protocols Count:</p>
                    <p className="font-mono">{hyperevmData.protocols?.length || 0}</p>
                  </div>
                </div>

                {hyperevmData.error && (
                  <div className="bg-red-900/20 border border-red-500 rounded p-3">
                    <p className="text-red-400 text-sm">Error: {hyperevmData.error}</p>
                  </div>
                )}

                {hyperevmData.debug_info && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Debug Info:</p>
                    <div className="bg-[#1a2e2a] rounded p-3">
                      <pre className="text-xs font-mono">{JSON.stringify(hyperevmData.debug_info, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Recent Historical Data */}
                {hyperevmData.historical_data && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Recent Historical Data (Last 5 days):</p>
                    <div className="bg-[#1a2e2a] rounded p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs font-mono">
                        {JSON.stringify(hyperevmData.historical_data.slice(-5), null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Loading HyperEVM data...</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue Data Debug */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">Revenue Data Debug</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Daily Revenue:</p>
                    <p className="font-mono">{formatValue(revenueData.daily_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Annualized Revenue:</p>
                    <p className="font-mono">{formatValue(revenueData.annualized_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Latest Day:</p>
                    <p className="font-mono">{revenueData.latest_day || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Previous Day Revenue:</p>
                    <p className="font-mono">{formatValue(revenueData.previous_day_revenue)}</p>
                  </div>
                </div>

                {revenueData.error && (
                  <div className="bg-red-900/20 border border-red-500 rounded p-3">
                    <p className="text-red-400 text-sm">Error: {revenueData.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Loading Revenue data...</p>
            )}
          </CardContent>
        </Card>

        {/* Raw API Responses */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">Raw API Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Dune API Response:</p>
                <div className="bg-[#1a2e2a] rounded p-3 max-h-60 overflow-y-auto">
                  <pre className="text-xs font-mono">{duneData ? JSON.stringify(duneData, null, 2) : "Loading..."}</pre>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">HyperEVM API Response:</p>
                <div className="bg-[#1a2e2a] rounded p-3 max-h-60 overflow-y-auto">
                  <pre className="text-xs font-mono">
                    {hyperevmData ? JSON.stringify(hyperevmData, null, 2) : "Loading..."}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Direct Check */}
        <Card className="bg-[#0f1a1f] border-[#1a2e2a]">
          <CardHeader>
            <CardTitle className="text-white">Database Direct Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Check if May 29, 2025 data exists in the database by looking at the latest entries above. Look for dates
                like "2025-05-29" in the historical data.
              </p>

              <div className="bg-yellow-900/20 border border-yellow-500 rounded p-3">
                <p className="text-yellow-400 text-sm font-semibold">Things to check:</p>
                <ul className="text-yellow-400 text-sm mt-2 space-y-1">
                  <li>• Is the latest_day showing 2025-05-29?</li>
                  <li>• Are there entries with date "2025-05-29" in historical data?</li>
                  <li>• Is the total_rows_in_db increasing?</li>
                  <li>• Are there any error messages in the API responses?</li>
                  <li>• Is the last_updated timestamp recent?</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DebugDataPage() {
  return (
    <DebugAuth title="Debug Data Access">
      <DebugDataContent />
    </DebugAuth>
  )
}
