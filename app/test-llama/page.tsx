"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react"

interface LlamaTestData {
  success: boolean
  data?: Array<{
    day: string
    totalDailyTvl: number
    protocols: Array<{ name: string; dailyTvl: number }>
  }>
  metadata?: {
    totalProtocolsFetched: number
    totalProtocolsAttempted: number
    totalEntries: number
    dedupedEntries: number
    daysWithData: number
    lastUpdated: string
  }
  error?: string
}

export default function TestLlamaPage() {
  const [data, setData] = useState<LlamaTestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/hyperevm-llama-tvl")
      const result = await response.json()

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatTVL = (tvl: number): string => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`
    return `$${tvl.toFixed(2)}`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">HyperEVM Llama API Test</h1>
        <Button onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            API Status
            {data?.success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : error ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}
          {data?.success && <p className="text-green-500">Successfully fetched data from Llama API</p>}
          {data && !data.success && <p className="text-red-500">API Error: {data.error}</p>}
        </CardContent>
      </Card>

      {/* Metadata Card */}
      {data?.metadata && (
        <Card>
          <CardHeader>
            <CardTitle>Fetch Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Protocols Fetched</p>
                <p className="text-lg font-semibold">
                  {data.metadata.totalProtocolsFetched}/{data.metadata.totalProtocolsAttempted}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Entries</p>
                <p className="text-lg font-semibold">{data.metadata.totalEntries.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Deduped Entries</p>
                <p className="text-lg font-semibold">{data.metadata.dedupedEntries.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Days with Data</p>
                <p className="text-lg font-semibold">{data.metadata.daysWithData}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-lg font-semibold">{new Date(data.metadata.lastUpdated).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TVL Data */}
      {data?.data && (
        <div className="space-y-4">
          {data.data.map((dayData, index) => (
            <Card key={dayData.day}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{dayData.day}</span>
                  <Badge variant={index === 0 ? "default" : "secondary"}>
                    {index === 0 ? "Latest" : `${index} day${index === 1 ? "" : "s"} ago`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Total TVL</p>
                  <p className="text-2xl font-bold">{formatTVL(dayData.totalDailyTvl)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-2">Protocol Breakdown</p>
                  <div className="space-y-2">
                    {dayData.protocols.map((protocol) => (
                      <div key={protocol.name} className="flex justify-between items-center">
                        <span className="text-sm">{protocol.name}</span>
                        <span className="font-mono text-sm">{formatTVL(protocol.dailyTvl)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Raw JSON for debugging */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Response (for debugging)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
