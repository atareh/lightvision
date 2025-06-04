"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface CronEndpoint {
  id: string
  name: string
  description: string
  path: string
  method?: "GET" | "POST"
}

const cronEndpoints: CronEndpoint[] = [
  {
    id: "token-price-refresh",
    name: "Token Price & Holder Refresh",
    description:
      "Fetches latest token prices from DexScreener and holder counts from HyperScan. Updates token_metrics table. Runs every 30 mins.",
    path: "/api/cron/token-price-refresh",
    method: "POST",
  },
  {
    id: "geckoterminal-sync",
    name: "GeckoTerminal Sync (All Tokens)",
    description: "Syncs all tokens from GeckoTerminal. Runs daily.",
    path: "/api/cron/geckoterminal-sync",
    method: "POST",
  },
  {
    id: "update-token-filter-status",
    name: "Update Token Filter Status",
    description: "Checks and updates low liquidity/volume flags for tokens. Runs every hour.",
    path: "/api/cron/update-token-filter-status",
    method: "POST",
  },
  {
    id: "token-social-sync",
    name: "Token Social Sync",
    description: "Syncs social media links for tokens. Runs daily.",
    path: "/api/cron/token-social-sync",
    method: "POST",
  },
  {
    id: "hyperevm-sync-llama",
    name: "HyperEVM Llama TVL Sync",
    description: "Syncs HyperEVM TVL data from DefiLlama. Runs every hour.",
    path: "/api/cron/hyperevm-sync-llama",
    method: "POST",
  },
  {
    id: "hyperliquid-sync-revenue",
    name: "Hyperliquid Llama Revenue Sync",
    description: "Syncs Hyperliquid revenue data from DefiLlama. Runs daily.",
    path: "/api/cron/hyperliquid-sync-revenue",
    method: "POST",
  },
  {
    id: "daily-dune-sync",
    name: "Daily Dune Analytics Sync",
    description: "Triggers daily Dune Analytics queries. Runs daily.",
    path: "/api/cron/daily-dune-sync",
    method: "POST",
  },
  {
    id: "poll-dune-results",
    name: "Poll Dune Analytics Results",
    description: "Polls for results of triggered Dune queries. Runs frequently.",
    path: "/api/cron/poll-dune-results",
    method: "POST",
  },
  // Add other cron jobs here if needed
]

export default function DebugCronPage() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [debugPassword, setDebugPassword] = useState<string>("")

  const handleRunCron = async (endpoint: CronEndpoint) => {
    if (!process.env.NEXT_PUBLIC_DEBUG_PASSWORD && !debugPassword) {
      toast.error("Debug password is required to run cron jobs manually. Set NEXT_PUBLIC_DEBUG_PASSWORD or enter one.")
      return
    }
    const currentPassword = debugPassword || process.env.NEXT_PUBLIC_DEBUG_PASSWORD

    setLoading((prev) => ({ ...prev, [endpoint.id]: true }))
    setResults((prev) => ({ ...prev, [endpoint.id]: null }))
    try {
      const response = await fetch(endpoint.path, {
        method: endpoint.method || "POST", // Default to POST
        headers: {
          "Content-Type": "application/json",
          "x-debug-password": currentPassword!,
        },
      })
      const data = await response.json()
      setResults((prev) => ({ ...prev, [endpoint.id]: data }))
      if (response.ok) {
        toast.success(`${endpoint.name} finished successfully.`)
      } else {
        toast.error(`${endpoint.name} failed: ${data.message || response.statusText}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setResults((prev) => ({ ...prev, [endpoint.id]: { error: errorMessage } }))
      toast.error(`Error running ${endpoint.name}: ${errorMessage}`)
    } finally {
      setLoading((prev) => ({ ...prev, [endpoint.id]: false }))
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-background text-foreground min-h-screen">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Debug Cron Jobs</CardTitle>
          <CardDescription>
            Manually trigger cron jobs for testing and initial data population. Ensure your CRON_SECRET (for deployed
            environments) or DEBUG_PASSWORD (for local/dev) is correctly set in your environment variables. The
            `x-debug-password` header will be used if you provide a password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="debugPasswordInput" className="block text-sm font-medium mb-1">
            Debug Password (optional, overrides NEXT_PUBLIC_DEBUG_PASSWORD if set):
          </label>
          <input
            id="debugPasswordInput"
            type="password"
            value={debugPassword}
            onChange={(e) => setDebugPassword(e.target.value)}
            placeholder="Enter debug password if needed"
            className="w-full p-2 border rounded-md bg-input text-foreground border-border mb-4"
          />
          <p className="text-xs text-muted-foreground">
            Note: For scheduled Vercel cron jobs, the `Authorization: Bearer CRON_SECRET` header is used. For manual
            triggering via this page, either `NEXT_PUBLIC_DEBUG_PASSWORD` must be set in your environment (and available
            publicly for local development) or you can enter a password above. This password will be sent in the
            `x-debug-password` header. The cron endpoints must be configured to accept this header for manual triggers.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cronEndpoints.map((endpoint) => (
          <Card key={endpoint.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{endpoint.name}</CardTitle>
              <CardDescription>{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <Button onClick={() => handleRunCron(endpoint)} disabled={loading[endpoint.id]} className="w-full mb-4">
                {loading[endpoint.id] ? "Running..." : `Run ${endpoint.method || "POST"}`}
              </Button>
              {results[endpoint.id] && (
                <ScrollArea className="h-48 w-full rounded-md border p-3 bg-muted">
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(results[endpoint.id], null, 2)}</pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
