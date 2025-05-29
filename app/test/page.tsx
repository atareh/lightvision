"use client"

import DebugAuth from "@/components/debug-auth"
import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Loader2, Play, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TestResult {
  success: boolean
  message: string
  timestamp: string
  result?: any
  error?: string
}

interface ExecutionStatus {
  execution_id: string
  status: string
  created_at: string
  updated_at: string
  completed_at?: string
  row_count?: number
  error_message?: string
}

const ResultCard = ({ title, result, icon }: { title: string; result: TestResult | null; icon: React.ReactNode }) => (
  <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-white">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {result && (
        <>
          <div className="flex items-center gap-2">
            <Badge
              variant={result.success ? "default" : "destructive"}
              className={result.success ? "bg-[#20a67d] text-black" : "bg-[#ed7188] text-white"}
            >
              {result.success ? "Success" : "Failed"}
            </Badge>
            <span className="text-sm text-[#868d8f]">{new Date(result.timestamp).toLocaleTimeString()}</span>
          </div>

          <div>
            <p className="text-white font-medium">{result.message}</p>
            {result.error && <p className="text-[#ed7188] text-sm mt-1">Error: {result.error}</p>}
          </div>

          {result.result && (
            <details className="text-sm">
              <summary className="text-[#51d2c1] cursor-pointer hover:text-white">View Details</summary>
              <pre className="mt-2 p-3 bg-[#2d5a4f] rounded text-xs overflow-auto text-white">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}
    </CardContent>
  </Card>
)

export default function TestPage() {
  const [duneLoading, setDuneLoading] = useState(false)
  const [duneResult, setDuneResult] = useState<TestResult | null>(null)
  const [duneExecutionLoading, setDuneExecutionLoading] = useState(false)
  const [duneExecutionResult, setDuneExecutionResult] = useState<TestResult | null>(null)
  const [cmcLoading, setCmcLoading] = useState(false)
  const [cmcResult, setCmcResult] = useState<TestResult | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)
  const [revenueResult, setRevenueResult] = useState<TestResult | null>(null)
  const [tokenRefreshLoading, setTokenRefreshLoading] = useState(false)
  const [tokenRefreshResult, setTokenRefreshResult] = useState<TestResult | null>(null)
  const [cmcCronLoading, setCmcCronLoading] = useState(false)
  const [cmcCronResult, setCmcCronResult] = useState<TestResult | null>(null)

  const testDuneSync = async () => {
    setDuneLoading(true)
    setDuneResult(null)

    try {
      const response = await fetch("/api/dune-sync", {
        method: "POST",
      })

      const result = await response.json()
      setDuneResult({
        success: response.ok,
        message: result.message || (response.ok ? "Dune sync completed" : "Dune sync failed"),
        timestamp: new Date().toISOString(),
        result: result,
        error: result.error,
      })
    } catch (error) {
      setDuneResult({
        success: false,
        message: "Network error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setDuneLoading(false)
    }
  }

  const testHyperEVMSync = async () => {
    setDuneExecutionLoading(true)
    setDuneExecutionResult(null)

    try {
      const response = await fetch("/api/hyperevm-sync", {
        method: "POST",
      })

      const result = await response.json()
      setDuneExecutionResult({
        success: response.ok,
        message: result.message || (response.ok ? "HyperEVM sync completed" : "HyperEVM sync failed"),
        timestamp: new Date().toISOString(),
        result: result,
        error: result.error,
      })
    } catch (error) {
      setDuneExecutionResult({
        success: false,
        message: "Network error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setDuneExecutionLoading(false)
    }
  }

  const testCmcSync = async () => {
    setCmcLoading(true)
    setCmcResult(null)

    try {
      const response = await fetch("/api/cmc-sync", {
        method: "POST",
      })

      const result = await response.json()
      setCmcResult({
        success: response.ok,
        message: result.message || (response.ok ? "CMC sync completed" : "CMC sync failed"),
        timestamp: new Date().toISOString(),
        result: result,
        error: result.error,
      })
    } catch (error) {
      setCmcResult({
        success: false,
        message: "Network error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setCmcLoading(false)
    }
  }

  const testRevenueSync = async () => {
    setRevenueLoading(true)
    setRevenueResult(null)

    try {
      const response = await fetch("/api/revenue-sync", {
        method: "POST",
      })

      const result = await response.json()
      setRevenueResult({
        success: response.ok,
        message: result.message || (response.ok ? "Revenue sync completed" : "Revenue sync failed"),
        timestamp: new Date().toISOString(),
        result: result,
        error: result.error,
      })
    } catch (error) {
      setRevenueResult({
        success: false,
        message: "Network error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setRevenueLoading(false)
    }
  }

  return (
    <DebugAuth title="Test Page">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Test Page</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Play className="h-5 w-5 text-[#51d2c1]" />
                Hyperliquid Stats Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Sync HYPE data from Dune query 5184581.</p>
              <Button
                onClick={testDuneSync}
                disabled={duneLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {duneLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing Hyperliquid...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync Hyperliquid Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Play className="h-5 w-5 text-[#51d2c1]" />
                HyperEVM Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Sync HyperEVM TVL data from Dune query 5184111.</p>
              <Button
                onClick={testHyperEVMSync}
                disabled={duneExecutionLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {duneExecutionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing HyperEVM...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync HyperEVM Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5 text-[#51d2c1]" />
                CMC Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Sync HYPE price data from CoinMarketCap API.</p>
              <Button
                onClick={testCmcSync}
                disabled={cmcLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {cmcLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing CMC...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync CMC Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5 text-[#51d2c1]" />
                Revenue Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Sync daily revenue data from Dune query 5184711.</p>
              <Button
                onClick={testRevenueSync}
                disabled={revenueLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {revenueLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing Revenue...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Sync Revenue Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <RefreshCw className="h-5 w-5 text-[#51d2c1]" />
                CMC Cron Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Test the 10-minute CMC cron job manually.</p>
              <Button
                onClick={async () => {
                  setCmcCronLoading(true)
                  setCmcCronResult(null)
                  try {
                    const response = await fetch("/api/cron/cmc-sync", { method: "POST" })
                    const result = await response.json()
                    setCmcCronResult({
                      success: response.ok,
                      message: result.message || (response.ok ? "CMC cron completed" : "CMC cron failed"),
                      timestamp: new Date().toISOString(),
                      result: result,
                      error: result.error,
                    })
                  } catch (error) {
                    setCmcCronResult({
                      success: false,
                      message: "Network error",
                      timestamp: new Date().toISOString(),
                      error: error instanceof Error ? error.message : "Unknown error",
                    })
                  } finally {
                    setCmcCronLoading(false)
                  }
                }}
                disabled={cmcCronLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {cmcCronLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing CMC Cron...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Test CMC Cron
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <RefreshCw className="h-5 w-5 text-[#51d2c1]" />
                HyperEVM Memes Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">Test the 5-minute HyperEVM memes refresh cron job manually.</p>
              <Button
                onClick={async () => {
                  setTokenRefreshLoading(true)
                  setTokenRefreshResult(null)
                  try {
                    const response = await fetch("/api/cron/token-refresh", { method: "POST" })
                    const result = await response.json()
                    setTokenRefreshResult({
                      success: response.ok,
                      message: result.message || (response.ok ? "Token refresh completed" : "Token refresh failed"),
                      timestamp: new Date().toISOString(),
                      result: result,
                      error: result.error,
                    })
                  } catch (error) {
                    setTokenRefreshResult({
                      success: false,
                      message: "Network error",
                      timestamp: new Date().toISOString(),
                      error: error instanceof Error ? error.message : "Unknown error",
                    })
                  } finally {
                    setTokenRefreshLoading(false)
                  }
                }}
                disabled={tokenRefreshLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {tokenRefreshLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Memes Refresh...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Test Memes Refresh
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <RefreshCw className="h-5 w-5 text-[#51d2c1]" />
                Memes Metrics Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] text-sm mb-4">
                Test the hourly memes metrics aggregation cron job manually.
              </p>
              <Button
                onClick={async () => {
                  setTokenRefreshLoading(true)
                  setTokenRefreshResult(null)
                  try {
                    const response = await fetch("/api/cron/memes-metrics", { method: "POST" })
                    const result = await response.json()
                    setTokenRefreshResult({
                      success: response.ok,
                      message: result.message || (response.ok ? "Memes metrics completed" : "Memes metrics failed"),
                      timestamp: new Date().toISOString(),
                      result: result,
                      error: result.error,
                    })
                  } catch (error) {
                    setTokenRefreshResult({
                      success: false,
                      message: "Network error",
                      timestamp: new Date().toISOString(),
                      error: error instanceof Error ? error.message : "Unknown error",
                    })
                  } finally {
                    setTokenRefreshLoading(false)
                  }
                }}
                disabled={tokenRefreshLoading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors"
              >
                {tokenRefreshLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Memes Metrics...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Test Memes Metrics
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <ResultCard
            title="Hyperliquid Stats Sync Results"
            result={duneResult}
            icon={<Play className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="HyperEVM Sync Results"
            result={duneExecutionResult}
            icon={<Play className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="CMC Sync Results"
            result={cmcResult}
            icon={<DollarSign className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="Revenue Sync Results"
            result={revenueResult}
            icon={<DollarSign className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="CMC Cron Test Results"
            result={cmcCronResult}
            icon={<RefreshCw className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="HyperEVM Memes Test Results"
            result={tokenRefreshResult}
            icon={<RefreshCw className="h-5 w-5 text-[#51d2c1]" />}
          />
          <ResultCard
            title="Memes Metrics Test Results"
            result={tokenRefreshResult}
            icon={<RefreshCw className="h-5 w-5 text-[#51d2c1]" />}
          />
        </div>
      </div>
    </DebugAuth>
  )
}
