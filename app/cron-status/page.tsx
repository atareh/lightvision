"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Play, ChevronDown, ChevronRight } from "lucide-react"
import DebugAuth from "@/components/debug-auth"

interface CronLog {
  id: number
  execution_id: string
  cron_type: string
  status: string
  started_at: string
  completed_at?: string
  duration_ms?: number
  success_count: number
  error_count: number
  results?: any
  error_message?: string
}

interface CronSummary {
  total_runs: number
  successful_runs: number
  failed_runs: number
  partial_failures: number
  last_run?: string
  next_scheduled: string
  daily_sync?: { successful: number; failed: number }
  cmc_sync?: { last_run?: string; successful: number; failed: number }
}

interface DataStatus {
  table: string
  last_updated?: string
  record_count?: number
  status: "success" | "error" | "stale" | "empty"
  message?: string
}

export default function CronStatusPage() {
  const [loading, setLoading] = useState(true)
  const [cronLogs, setCronLogs] = useState<CronLog[]>([])
  const [cronSummary, setCronSummary] = useState<CronSummary | null>(null)
  const [dataStatus, setDataStatus] = useState<DataStatus[]>([])
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setLoading(true)
    try {
      // Fetch cron logs
      const cronResponse = await fetch("/api/cron-logs")
      if (cronResponse.ok) {
        const cronData = await cronResponse.json()
        setCronLogs(cronData.logs || [])
        setCronSummary(cronData.summary || null)
      }

      // Check each data source
      const checks = await Promise.allSettled([
        fetch("/api/dune-data").then((r) => r.json()),
        fetch("/api/hyperevm-tvl").then((r) => r.json()),
        fetch("/api/revenue-data").then((r) => r.json()),
        fetch("/api/crypto-data").then((r) => r.json()),
      ])

      const statuses: DataStatus[] = []

      // Dune data status
      if (checks[0].status === "fulfilled") {
        const data = checks[0].value
        statuses.push({
          table: "Hyperliquid Stats",
          last_updated: data.last_updated,
          status: data.error ? "error" : "success",
          message: data.error || `${data.total_rows_in_db || 0} records`,
        })
      } else {
        statuses.push({
          table: "Hyperliquid Stats",
          status: "error",
          message: "Failed to fetch",
        })
      }

      // HyperEVM data status
      if (checks[1].status === "fulfilled") {
        const data = checks[1].value
        statuses.push({
          table: "HyperEVM TVL",
          last_updated: data.last_updated,
          status: data.error ? "error" : "success",
          message: data.error || `$${(data.current_tvl / 1e6).toFixed(1)}M TVL`,
        })
      } else {
        statuses.push({
          table: "HyperEVM TVL",
          status: "error",
          message: "Failed to fetch",
        })
      }

      // Revenue data status
      if (checks[2].status === "fulfilled") {
        const data = checks[2].value
        statuses.push({
          table: "Daily Revenue",
          last_updated: data.last_updated,
          status: data.error ? "error" : "success",
          message: data.error || `$${(data.daily_revenue / 1e3).toFixed(1)}K daily`,
        })
      } else {
        statuses.push({
          table: "Daily Revenue",
          status: "error",
          message: "Failed to fetch",
        })
      }

      // CMC data status
      if (checks[3].status === "fulfilled") {
        const data = checks[3].value
        if (data.meta) {
          statuses.push({
            table: "HYPE Price Data",
            last_updated: data.meta.synced_at,
            status: data.meta.is_stale ? "stale" : "success",
            message: `$${data.hype.price.toFixed(2)} (${data.meta.data_age_minutes}min old)`,
          })
        } else {
          statuses.push({
            table: "HYPE Price Data",
            status: "error",
            message: data.error || "No data",
          })
        }
      } else {
        statuses.push({
          table: "HYPE Price Data",
          status: "error",
          message: "Failed to fetch",
        })
      }

      setDataStatus(statuses)
    } catch (error) {
      console.error("Error checking status:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "success":
        return <CheckCircle className="h-4 w-4 text-[#20a67d]" />
      case "FAILED":
      case "error":
      case "empty":
        return <XCircle className="h-4 w-4 text-[#ed7188]" />
      case "PARTIAL_FAILURE":
      case "stale":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "RUNNING":
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />
      default:
        return <Clock className="h-4 w-4 text-[#868d8f]" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-[#20a67d] text-black">Completed</Badge>
      case "FAILED":
        return <Badge className="bg-[#ed7188] text-white">Failed</Badge>
      case "PARTIAL_FAILURE":
        return <Badge className="bg-yellow-500 text-black">Partial</Badge>
      case "RUNNING":
        return <Badge className="bg-blue-500 text-white">Running</Badge>
      default:
        return <Badge className="bg-[#868d8f] text-white">Unknown</Badge>
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return "—"
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  return (
    <DebugAuth title="Cron Status">
      <div
        className="min-h-screen text-white p-6"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Cron Job Status</h1>
              <p className="text-[#868d8f]">Dune sync runs at 6:00 AM & 6:00 PM ET (10:00 AM & 10:00 PM UTC)</p>
            </div>
            <Button
              onClick={checkStatus}
              disabled={loading}
              className="bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1]"
            >
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {/* Summary Stats */}
          {cronSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#20a67d]">{cronSummary.successful_runs}</div>
                    <div className="text-sm text-[#868d8f]">Successful</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">{cronSummary.partial_failures}</div>
                    <div className="text-sm text-[#868d8f]">Partial</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#ed7188]">{cronSummary.failed_runs}</div>
                    <div className="text-sm text-[#868d8f]">Failed</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{cronSummary.total_runs}</div>
                    <div className="text-sm text-[#868d8f]">Total Runs</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Schedule Information - Updated */}
          {cronSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Daily Sync Schedule */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#51d2c1]" />
                    Dune Sync (6am & 6pm ET)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-[#868d8f]">Last Run</p>
                      <p className="text-lg">{cronSummary.last_run ? formatTime(cronSummary.last_run) : "Never"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#868d8f]">Next Scheduled</p>
                      <p className="text-lg">{formatTime(cronSummary.next_scheduled)}</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-[#20a67d]">{cronSummary.daily_sync?.successful || 0}</span> successful,
                      <span className="text-[#ed7188] ml-1">{cronSummary.daily_sync?.failed || 0}</span> failed
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CMC Sync Schedule */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-[#51d2c1]" />
                    CMC Sync (Every 10min)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-[#868d8f]">Last Run</p>
                      <p className="text-lg">
                        {cronSummary.cmc_sync?.last_run ? formatTime(cronSummary.cmc_sync.last_run) : "Never"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#868d8f]">Frequency</p>
                      <p className="text-lg">Every 10 minutes</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-[#20a67d]">{cronSummary.cmc_sync?.successful || 0}</span> successful,
                      <span className="text-[#ed7188] ml-1">{cronSummary.cmc_sync?.failed || 0}</span> failed
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Cron Executions */}
          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl mb-6">
            <CardHeader>
              <CardTitle>Recent Cron Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {cronLogs.length === 0 ? (
                <p className="text-[#868d8f] text-center py-8">No cron executions found</p>
              ) : (
                <div className="space-y-4">
                  {cronLogs.map((log) => (
                    <div key={log.id} className="border border-[#2d5a4f] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <div className="font-medium">{log.execution_id}</div>
                            <div className="text-sm text-[#868d8f]">{formatTime(log.started_at)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(log.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLogExpansion(log.id)}
                            className="text-[#868d8f] hover:text-white"
                          >
                            {expandedLogs.has(log.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-[#868d8f]">Duration:</span> {formatDuration(log.duration_ms)}
                        </div>
                        <div>
                          <span className="text-[#868d8f]">Success:</span>{" "}
                          <span className="text-[#20a67d]">{log.success_count}</span>
                        </div>
                        <div>
                          <span className="text-[#868d8f]">Errors:</span>{" "}
                          <span className="text-[#ed7188]">{log.error_count}</span>
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="mt-2 p-2 bg-[#ed7188]/10 border border-[#ed7188] rounded text-sm">
                          <span className="text-[#ed7188]">Error:</span> {log.error_message}
                        </div>
                      )}

                      {expandedLogs.has(log.id) && log.results && (
                        <div className="mt-4 space-y-2">
                          {log.results.progress && (
                            <div>
                              <h4 className="font-medium mb-2">Progress Log:</h4>
                              <div className="bg-[#2d5a4f] rounded p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
                                {log.results.progress.map((entry: any, idx: number) => (
                                  <div key={idx} className="flex gap-2">
                                    <span className="text-[#868d8f]">
                                      {new Date(entry.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span>{entry.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <details className="bg-[#2d5a4f] rounded p-3">
                            <summary className="cursor-pointer text-[#51d2c1] text-sm">View Full Results</summary>
                            <pre className="mt-2 text-xs overflow-auto text-white">
                              {JSON.stringify(log.results, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Source Status */}
          <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
            <CardHeader>
              <CardTitle>Data Source Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataStatus.map((item, index) => (
                  <div key={index} className="border border-[#2d5a4f] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="font-medium">{item.table}</span>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-[#868d8f] mb-1">{item.message || "No additional info"}</p>
                    {item.last_updated && (
                      <p className="text-xs text-[#868d8f]">Last updated: {formatTime(item.last_updated)}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DebugAuth>
  )
}
