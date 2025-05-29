"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import DebugAuth from "@/components/debug-auth"

const MISSED_EXECUTIONS = [
  "01JW6TZ1A4HEYF4B1T45QA6MQ4", // HyperEVM - 45 rows
  "01JW6TFS5E3AZ7Z3ZXENA1YHYA", // Main Dune - 4 rows
  "01JW6T44WSVY7TPK3G4RPFEJPT", // Revenue - 7 rows
]

export default function TestManualPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugPassword, setDebugPassword] = useState("")

  const testManualProcessing = async (force = false) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log(`🔧 Testing manual processing of missed 6pm executions... ${force ? "(FORCE MODE)" : ""}`)

      const response = await fetch("/api/manual-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-debug-password": debugPassword, // SECURITY: Add auth header
        },
        body: JSON.stringify({
          execution_ids: MISSED_EXECUTIONS,
          force: force,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)

      if (data.success) {
        console.log(`✅ Successfully processed ${data.success_count}/${MISSED_EXECUTIONS.length} executions!`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setError(errorMsg)
      console.error("❌ Test failed:", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const triggerFreshSync = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log("🔄 Triggering fresh Dune sync...")

      const response = await fetch("/api/dune-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-debug-password": debugPassword, // SECURITY: Add auth header
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult({
        success: true,
        message: "Fresh sync triggered successfully",
        execution_ids: data.execution_ids,
        details: data,
      })

      console.log("✅ Fresh sync triggered! New execution IDs:", data.execution_ids)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setError(errorMsg)
      console.error("❌ Fresh sync failed:", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const triggerTokenRefresh = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log("🔄 Triggering token refresh...")

      const response = await fetch("/api/cron/token-refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-debug-password": debugPassword, // SECURITY: Add auth header
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult({
        success: true,
        message: "Token refresh completed successfully",
        details: data,
      })

      console.log("✅ Token refresh completed!", data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setError(errorMsg)
      console.error("❌ Token refresh failed:", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const checkSocialData = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log("🔍 Checking social data...")

      const response = await fetch("/api/debug-social", {
        method: "GET",
        headers: {
          "x-debug-password": debugPassword, // SECURITY: Add auth header
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult({
        success: true,
        message: "Social data retrieved successfully",
        details: data,
      })

      console.log("✅ Social data retrieved!", data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setError(errorMsg)
      console.error("❌ Social data check failed:", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DebugAuth title="Manual Testing" onPasswordChange={setDebugPassword}>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Test Manual Processing</h1>

          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-green-400">Missed 6pm Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                {MISSED_EXECUTIONS.map((id, index) => (
                  <div key={id} className="font-mono text-sm bg-gray-700 p-2 rounded">
                    {index === 0 && "HyperEVM: "}
                    {index === 1 && "Main Dune: "}
                    {index === 2 && "Revenue: "}
                    {id}
                  </div>
                ))}
              </div>

              <Button
                onClick={() => testManualProcessing(false)}
                disabled={loading || !debugPassword}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? "Processing..." : "Process Missed Executions"}
              </Button>
              <Button
                onClick={() => testManualProcessing(true)}
                disabled={loading || !debugPassword}
                className="bg-orange-600 hover:bg-orange-700 ml-2"
              >
                {loading ? "Force Processing..." : "Force Reprocess"}
              </Button>
              <Button
                onClick={triggerFreshSync}
                disabled={loading || !debugPassword}
                className="bg-blue-600 hover:bg-blue-700 ml-2"
              >
                {loading ? "Syncing..." : "Trigger Fresh Sync"}
              </Button>
              <Button
                onClick={triggerTokenRefresh}
                disabled={loading || !debugPassword}
                className="bg-purple-600 hover:bg-purple-700 ml-2"
              >
                {loading ? "Refreshing..." : "Refresh Token Data"}
              </Button>
              <Button
                onClick={checkSocialData}
                disabled={loading || !debugPassword}
                className="bg-cyan-600 hover:bg-cyan-700 ml-2"
              >
                {loading ? "Checking..." : "Check Social Data"}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="bg-red-900 border-red-700 mb-6">
              <CardHeader>
                <CardTitle className="text-red-400">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-red-300 whitespace-pre-wrap">{error}</pre>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className={result.success ? "text-green-400" : "text-red-400"}>Processing Result</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Success Count:</span>
                      <span className="ml-2 text-green-400">{result.success_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Fail Count:</span>
                      <span className="ml-2 text-red-400">{result.fail_count}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Detailed Results:</h3>
                    <pre className="bg-gray-700 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DebugAuth>
  )
}
