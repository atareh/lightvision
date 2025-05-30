import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period")

    // Get all revenue data ordered by date - KEEPING ORIGINAL ORDERING
    const { data, error } = await supabase.from("daily_revenue").select("*").order("day", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch revenue data from database. Please sync first using POST /api/manual-revenue-sync",
        },
        { status: 500 },
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        daily_revenue: 0,
        daily_change: 0,
        annualized_revenue: 0,
        last_updated: new Date().toISOString(),
        error: "No revenue data found. Please sync first using POST /api/manual-revenue-sync",
      })
    }

    // Process the data to calculate metrics - KEEPING ORIGINAL LOGIC
    const processedData = processRevenueData(data)

    // If no period specified, return current data only
    if (!period) {
      return NextResponse.json(processedData)
    }

    // Calculate date range based on period
    const now = new Date()
    let daysBack = 7

    switch (period.toLowerCase()) {
      case "7d":
        daysBack = 7
        break
      case "30d":
        daysBack = 30
        break
      case "90d":
        daysBack = 90
        break
      case "max":
        daysBack = 365
        break
      default:
        daysBack = 7
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)

    // Filter historical data based on date range and sort ascending for cumulative calculation
    const historicalData = data
      .filter((item) => {
        const itemDate = new Date(item.day)
        return itemDate >= startDate
      })
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())

    // For revenue, we show actual daily values (not cumulative) since revenue is per-day
    const historical_daily_revenue = historicalData.map((item) => ({
      date: item.day,
      value: item.revenue || 0,
    }))

    const historical_annualized_revenue = historicalData.map((item) => ({
      date: item.day,
      value: item.annualized_revenue || 0,
    }))

    // Return both current and historical data
    return NextResponse.json({
      ...processedData,
      historical_daily_revenue,
      historical_annualized_revenue,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}

// KEEPING ORIGINAL PROCESSING FUNCTION
function processRevenueData(rows: any[]) {
  if (!rows || rows.length === 0) {
    return {
      daily_revenue: 0,
      daily_change: 0,
      annualized_revenue: 0,
      last_updated: new Date().toISOString(),
    }
  }

  // Sort by date to ensure we have the latest data
  const sortedRows = rows.sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())

  if (sortedRows.length === 0) {
    return {
      daily_revenue: 0,
      daily_change: 0,
      annualized_revenue: 0,
      last_updated: new Date().toISOString(),
    }
  }

  const latestRecord = sortedRows[0]
  const previousRecord = sortedRows.length > 1 ? sortedRows[1] : null

  // Calculate daily change using two most recent complete days
  const currentRevenue = latestRecord.revenue || 0
  let dailyChange = 0

  if (previousRecord) {
    const previousRevenue = previousRecord.revenue || 0
    dailyChange = currentRevenue - previousRevenue
  }

  return {
    daily_revenue: currentRevenue,
    daily_change: dailyChange,
    previous_day_revenue: previousRecord ? previousRecord.revenue || 0 : 0,
    annualized_revenue: latestRecord.annualized_revenue || 0,
    last_updated: new Date().toISOString(),
    latest_day: latestRecord.day,
    previous_day: previousRecord ? previousRecord.day : null,
    data_source: latestRecord.query_id === 999999 ? "DeFiLlama" : "Dune",
  }
}
