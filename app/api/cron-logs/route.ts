import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get recent cron logs (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: logs, error } = await supabase
      .from("cron_logs")
      .select("*")
      .gte("started_at", thirtyDaysAgo.toISOString())
      .order("started_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to fetch cron logs" }, { status: 500 })
    }

    // Get summary stats for both cron types
    const { data: stats } = await supabase
      .from("cron_logs")
      .select("status, started_at, cron_type")
      .gte("started_at", thirtyDaysAgo.toISOString())

    const dailySyncStats = stats?.filter((s) => s.cron_type === "daily_sync") || []
    const cmcSyncStats = stats?.filter((s) => s.cron_type === "cmc_sync") || []

    const summary = {
      total_runs: stats?.length || 0,
      successful_runs: stats?.filter((s) => s.status === "COMPLETED").length || 0,
      failed_runs: stats?.filter((s) => s.status === "FAILED").length || 0,
      partial_failures: stats?.filter((s) => s.status === "PARTIAL_FAILURE").length || 0,
      last_run: logs?.[0]?.started_at || null,
      next_scheduled: getNextScheduledRun(),
      daily_sync: {
        total: dailySyncStats.length,
        successful: dailySyncStats.filter((s) => s.status === "COMPLETED").length,
        failed: dailySyncStats.filter((s) => s.status === "FAILED").length,
      },
      cmc_sync: {
        total: cmcSyncStats.length,
        successful: cmcSyncStats.filter((s) => s.status === "COMPLETED").length,
        failed: cmcSyncStats.filter((s) => s.status === "FAILED").length,
        last_run: cmcSyncStats[0]?.started_at || null,
      },
    }

    return NextResponse.json({
      logs: logs || [],
      summary,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getNextScheduledRun(): string {
  const now = new Date()
  const next = new Date()

  // Get current hour in ET
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const currentHour = etNow.getHours()

  // Set to next 6am or 6pm ET
  if (currentHour < 6) {
    // Before 6am, next run is 6am today
    next.setUTCHours(10, 0, 0, 0) // 6am ET = 10am UTC (EST)
  } else if (currentHour < 18) {
    // Between 6am and 6pm, next run is 6pm today
    next.setUTCHours(22, 0, 0, 0) // 6pm ET = 10pm UTC (EST)
  } else {
    // After 6pm, next run is 6am tomorrow
    next.setDate(next.getDate() + 1)
    next.setUTCHours(10, 0, 0, 0) // 6am ET = 10am UTC (EST)
  }

  return next.toISOString()
}
