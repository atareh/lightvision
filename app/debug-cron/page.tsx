"use client"

import DebugAuth from "@/components/debug-auth"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Clock, AlertCircle } from "lucide-react"

export default function DebugCronPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testCronEndpoint = async () => {
    setTesting(true)
    setResult(null)

    try {
      const response = await fetch("/api/cron/daily-dune-sync", {
        method: "POST", // Using POST to manually test
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()
      setResult({
        status: response.status,
        ok: response.ok,
        data,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      setResult({
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <DebugAuth title="Debug Cron">
      <div
        className="min-h-screen text-white p-6"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Debug Cron Job</h1>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#51d2c1]" />
                Current Cron Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>Schedule:</strong> "0 22 * * *"
                </p>
                <p>
                  <strong>UTC Time:</strong> 10:00 PM UTC daily
                </p>
                <p>
                  <strong>EDT Time:</strong> 6:00 PM EDT (correct for now)
                </p>
                <p>
                  <strong>EST Time:</strong> 5:00 PM EST (winter - will be 1 hour early)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl mb-6">
            <CardHeader>
              <CardTitle>Manual Test</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#868d8f] mb-4">
                Test the cron endpoint manually to see if it's working. This will bypass the CRON_SECRET check.
              </p>
              <Button
                onClick={testCronEndpoint}
                disabled={testing}
                className="bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1]"
              >
                {testing ? (
                  <>
                    <Play className="mr-2 h-4 w-4 animate-spin" />
                    Testing Cron...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Test Cron Endpoint
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Test Results
                  <Badge className={result.ok ? "bg-[#20a67d] text-black" : "bg-[#ed7188] text-white"}>
                    {result.ok ? "Success" : "Failed"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p>
                      <strong>Status:</strong> {result.status}
                    </p>
                    <p>
                      <strong>Time:</strong> {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {result.error && (
                    <div className="bg-[#ed7188]/10 border border-[#ed7188] rounded p-3">
                      <p className="text-[#ed7188]">
                        <strong>Error:</strong> {result.error}
                      </p>
                    </div>
                  )}

                  {result.data && (
                    <details className="bg-[#2d5a4f] rounded p-3">
                      <summary className="cursor-pointer text-[#51d2c1]">View Full Response</summary>
                      <pre className="mt-2 text-xs overflow-auto text-white">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Troubleshooting Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-[#868d8f]">
                <li>Check Vercel Dashboard → Functions → Cron Jobs for execution logs</li>
                <li>Verify CRON_SECRET environment variable is set</li>
                <li>Test the endpoint manually using the button above</li>
                <li>Check if any recent deployments might have affected the cron</li>
                <li>Verify the cron job is enabled in Vercel settings</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </DebugAuth>
  )
}
