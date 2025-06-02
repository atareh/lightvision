"use client"

import DebugAuth from "@/components/debug-auth"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Loader2, Play, RefreshCw, TrendingUp, DatabaseZap, BarChartBig } from "lucide-react" // Added DatabaseZap, BarChartBig
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"

interface TestResult {
  success: boolean
  message: string
  timestamp: string
  result?: any
  error?: string
}

// ResultCard component remains the same
const ResultCard = ({ result, showTitle = false }: { result: TestResult | null; showTitle?: boolean }) => {
  if (!result) {
    return <p className="text-[#868d8f] text-sm mt-4">No result yet. Click the button above to run the test.</p>
  }
  return (
    <div className="mt-4 pt-4 border-t border-[#2d5a4f]">
      {showTitle && <h4 className="text-md font-semibold text-white mb-2">Result:</h4>}
      <div className="flex items-center gap-2 mb-2">
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
        <details className="text-sm mt-2">
          <summary className="text-[#51d2c1] cursor-pointer hover:text-white">View Details</summary>
          <pre className="mt-2 p-3 bg-[#2d5a4f] rounded text-xs overflow-auto text-white">
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

// New component for each test unit
const TestUnitCard = ({
  title,
  description,
  buttonText,
  onTrigger,
  isLoading,
  result,
  icon: Icon,
  requiresPassword = true,
}: {
  title: string
  description: string
  buttonText: string
  onTrigger: () => Promise<void>
  isLoading: boolean
  result: TestResult | null
  icon: React.ElementType
  requiresPassword?: boolean
}) => {
  return (
    <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Icon className="h-5 w-5 text-[#51d2c1]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <p className="text-[#868d8f] text-sm mb-4 flex-grow">
          {description} {requiresPassword && "(Requires Password)"}
        </p>
        <Button
          onClick={onTrigger}
          disabled={isLoading}
          className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] transition-colors mt-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> {buttonText}
            </>
          )}
        </Button>
        <ResultCard result={result} />
      </CardContent>
    </Card>
  )
}

export default function TestPage() {
  const [debugPassword, setDebugPassword] = useState("")

  const [llamaRevenueSyncLoading, setLlamaRevenueSyncLoading] = useState(false)
  const [llamaRevenueSyncResult, setLlamaRevenueSyncResult] = useState<TestResult | null>(null)

  const [cmcSyncLoading, setCmcSyncLoading] = useState(false)
  const [cmcSyncResult, setCmcSyncResult] = useState<TestResult | null>(null)

  const [cmcCronLoading, setCmcCronLoading] = useState(false)
  const [cmcCronResult, setCmcCronResult] = useState<TestResult | null>(null)

  const [memesRefreshLoading, setMemesRefreshLoading] = useState(false)
  const [memesRefreshResult, setMemesRefreshResult] = useState<TestResult | null>(null)

  const [memesMetricsLoading, setMemesMetricsLoading] = useState(false)
  const [memesMetricsResult, setMemesMetricsResult] = useState<TestResult | null>(null)

  // New state for HyperEVM TVL Sync
  const [hyperEVMSyncLoading, setHyperEVMSyncLoading] = useState(false)
  const [hyperEVMSyncResult, setHyperEVMSyncResult] = useState<TestResult | null>(null)

  // New state for manual Dune query trigger
  const [manualDuneTriggerLoading, setManualDuneTriggerLoading] = useState(false)
  const [manualDuneTriggerResult, setManualDuneTriggerResult] = useState<TestResult | null>(null)

  // Generic function to make API calls for tests
  const handleApiCall = async (
    endpoint: string,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setResult: React.Dispatch<React.SetStateAction<TestResult | null>>,
    successMessage: string,
    failureMessage: string,
    requiresPassword = true,
  ) => {
    if (requiresPassword && !debugPassword) {
      toast({ title: "Error", description: "Please enter the debug password.", variant: "destructive" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: requiresPassword ? { "Content-Type": "application/json" } : {},
        body: requiresPassword ? JSON.stringify({ password: debugPassword }) : undefined,
      })
      const resultData = await response.json()
      setResult({
        success: response.ok,
        message: resultData.message || (response.ok ? successMessage : failureMessage),
        timestamp: new Date().toISOString(),
        result: resultData,
        error: resultData.error,
      })
      if (!response.ok && resultData.error) {
        toast({ title: "API Error", description: resultData.error, variant: "destructive" })
      } else if (!response.ok) {
        toast({ title: "API Error", description: resultData.message || failureMessage, variant: "destructive" })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown network error."
      setResult({
        success: false,
        message: "Network error",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      })
      toast({ title: "Network Error", description: errorMessage, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DebugAuth title="Test Page - System Triggers">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6 text-white">Manual System Triggers</h1>

        <div className="mb-8 p-4 bg-[#0f1a1f] border border-[#2d5a4f] rounded-lg">
          <label htmlFor="debugPassword" className="block text-sm font-medium text-white mb-1">
            Debug Password
          </label>
          <Input
            id="debugPassword"
            type="password"
            value={debugPassword}
            onChange={(e) => setDebugPassword(e.target.value)}
            placeholder="Enter debug password"
            className="bg-gray-800 border-[#2d5a4f] text-white placeholder-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">Required for most manual trigger operations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <TestUnitCard
            title="Llama Revenue Sync"
            description="Manually trigger the daily revenue data sync from DeFiLlama."
            buttonText="Sync Llama Revenue"
            onTrigger={() =>
              handleApiCall(
                "/api/manual-revenue-sync",
                setLlamaRevenueSyncLoading,
                setLlamaRevenueSyncResult,
                "Llama Revenue sync completed successfully.",
                "Llama Revenue sync failed.",
              )
            }
            isLoading={llamaRevenueSyncLoading}
            result={llamaRevenueSyncResult}
            icon={TrendingUp}
          />

          <TestUnitCard
            title="HyperEVM TVL Sync"
            description="Manually trigger the HyperEVM TVL data sync from DeFiLlama."
            buttonText="Sync HyperEVM TVL"
            onTrigger={() =>
              handleApiCall(
                "/api/manual-hyperevm-llama-sync", // Assuming this is the manual endpoint
                setHyperEVMSyncLoading,
                setHyperEVMSyncResult,
                "HyperEVM TVL sync completed successfully.",
                "HyperEVM TVL sync failed.",
              )
            }
            isLoading={hyperEVMSyncLoading}
            result={hyperEVMSyncResult}
            icon={DatabaseZap} // New Icon
          />

          <TestUnitCard
            title="Manual Dune Query Trigger (HL Stats)"
            description="Manually trigger the main Hyperliquid Stats Dune query (ID 5184581) and record it for polling."
            buttonText="Trigger HL Stats Dune Query"
            onTrigger={() =>
              handleApiCall(
                "/api/manual-dune-query-trigger",
                setManualDuneTriggerLoading,
                setManualDuneTriggerResult,
                "Hyperliquid Stats Dune query triggered successfully.",
                "Failed to trigger Hyperliquid Stats Dune query.",
                true, // requiresPassword
              )
            }
            isLoading={manualDuneTriggerLoading}
            result={manualDuneTriggerResult}
            icon={DatabaseZap} // Or another suitable icon like PlayCircle
          />

          <TestUnitCard
            title="CMC Price Sync"
            description="Sync HYPE token price data from CoinMarketCap API."
            buttonText="Sync CMC Data"
            onTrigger={() =>
              handleApiCall(
                "/api/cmc-sync",
                setCmcSyncLoading,
                setCmcSyncResult,
                "CMC price sync completed successfully.",
                "CMC price sync failed.",
              )
            }
            isLoading={cmcSyncLoading}
            result={cmcSyncResult}
            icon={DollarSign}
          />

          <TestUnitCard
            title="CMC Cron Test"
            description="Test the 10-minute CMC price data cron job."
            buttonText="Test CMC Cron"
            onTrigger={() =>
              handleApiCall(
                "/api/cron/cmc-sync", // This is a cron endpoint, ensure it can be POSTed to with password or adjust
                setCmcCronLoading,
                setCmcCronResult,
                "CMC cron test completed successfully.",
                "CMC cron test failed.",
              )
            }
            isLoading={cmcCronLoading}
            result={cmcCronResult}
            icon={RefreshCw}
          />

          <TestUnitCard
            title="Memes Refresh Cron"
            description="Test the 5-minute HyperEVM memes token data refresh cron job."
            buttonText="Test Memes Refresh"
            onTrigger={() =>
              handleApiCall(
                "/api/cron/token-refresh",
                setMemesRefreshLoading,
                setMemesRefreshResult,
                "Memes refresh completed successfully.",
                "Memes refresh failed.",
              )
            }
            isLoading={memesRefreshLoading}
            result={memesRefreshResult}
            icon={RefreshCw}
          />

          <TestUnitCard
            title="Memes Metrics Cron"
            description="Test the hourly memes metrics aggregation cron job."
            buttonText="Test Memes Metrics"
            onTrigger={() =>
              handleApiCall(
                "/api/cron/memes-metrics",
                setMemesMetricsLoading,
                setMemesMetricsResult,
                "Memes metrics aggregation completed successfully.",
                "Memes metrics aggregation failed.",
              )
            }
            isLoading={memesMetricsLoading}
            result={memesMetricsResult}
            icon={BarChartBig} // New Icon
          />
        </div>
      </div>
    </DebugAuth>
  )
}
