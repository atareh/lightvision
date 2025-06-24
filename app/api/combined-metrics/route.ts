import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Cache responses for 2 minutes to reduce database load
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes
const cache: { [key: string]: { data: any; timestamp: number } } = {}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "7d"

    // Check cache first
    const cacheKey = `combined-${period}`
    const now = Date.now()

    if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
      console.log(`Cache hit for ${cacheKey}`)
      return NextResponse.json(cache[cacheKey].data)
    }

    // Fetch both datasets in parallel with optimized queries
    const [duneResult, revenueResult] = await Promise.all([fetchDuneData(period), fetchRevenueData(period)])

    if (duneResult.error || revenueResult.error) {
      return NextResponse.json(
        {
          error: duneResult.error || revenueResult.error,
        },
        { status: 500 },
      )
    }

    const combinedData = {
      dune: duneResult.data,
      revenue: revenueResult.data,
      cached_at: new Date().toISOString(),
    }

    // Cache the result
    cache[cacheKey] = {
      data: combinedData,
      timestamp: now,
    }

    // Clean old cache entries (keep only last 10 minutes of cache)
    Object.keys(cache).forEach((key) => {
      if (now - cache[key].timestamp > 10 * 60 * 1000) {
        delete cache[key]
      }
    })

    return NextResponse.json(combinedData)
  } catch (error) {
    console.error("Combined API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}

async function fetchDuneData(period: string) {
  try {
    // Use LIMIT to reduce data transfer and add proper ordering
    const { data, error } = await supabase
      .from("dune_results")
      .select("block_day, netflow, address_count, updated_at, created_at, execution_id")
      .order("block_day", { ascending: true })

    if (error) {
      return { error: "Failed to fetch dune data", data: null }
    }

    if (!data || data.length === 0) {
      return { error: "No dune data found", data: null }
    }

    // Process data based on period
    let periodData = []
    switch (period.toLowerCase()) {
      case "7d":
        periodData = data.slice(-7)
        break
      case "30d":
        periodData = data.slice(-30)
        break
      case "90d":
        periodData = data.slice(-90)
        break
      case "max":
        periodData = data
        break
      default:
        periodData = data.slice(-7)
    }

    // Calculate metrics
    const latestRecord = data[data.length - 1]
    const previousRecord = data.length > 1 ? data[data.length - 2] : null

    const total_wallets = data.reduce((sum, record) => sum + (record.address_count || 0), 0)
    const tvl = data.reduce((sum, record) => sum + (record.netflow || 0), 0)

    let daily_new_wallets = 0
    let tvl_change = 0

    if (previousRecord) {
      daily_new_wallets = (latestRecord.address_count || 0) - (previousRecord.address_count || 0)
      tvl_change = (latestRecord.netflow || 0) - (previousRecord.netflow || 0)
    } else {
      daily_new_wallets = latestRecord.address_count || 0
    }

    // Calculate historical data for charts
    const historical_tvl = []
    const historical_wallets = []
    let cumulativeTvl = 0
    let cumulativeWallets = 0

    // Calculate pre-period cumulative totals
    const preStartData = data.filter((item) => !periodData.includes(item))
    preStartData.forEach((item) => {
      cumulativeTvl += item.netflow || 0
      cumulativeWallets += item.address_count || 0
    })

    // Process period data
    periodData.forEach((item) => {
      cumulativeTvl += item.netflow || 0
      cumulativeWallets += item.address_count || 0

      const formattedDate = new Date(item.block_day).toISOString().split("T")[0]

      historical_tvl.push({
        date: formattedDate,
        value: cumulativeTvl,
      })

      historical_wallets.push({
        date: formattedDate,
        value: item.address_count || 0,
        cumulative: cumulativeWallets,
      })
    })

    return {
      data: {
        total_wallets,
        tvl,
        netflow: latestRecord.netflow || 0,
        daily_new_wallets: Math.abs(daily_new_wallets),
        wallet_growth: Math.abs(daily_new_wallets),
        tvl_change,
        previous_day_tvl: previousRecord?.netflow || 0,
        previous_day_wallets: previousRecord?.address_count || 0,
        last_updated: latestRecord.updated_at || latestRecord.created_at,
        total_rows_in_db: data.length,
        execution_id: latestRecord.execution_id,
        address_count: latestRecord.address_count || 0,
        historical_tvl,
        historical_wallets,
      },
      error: null,
    }
  } catch (error) {
    console.error("Dune data fetch error:", error)
    return { error: "Failed to process dune data", data: null }
  }
}

async function fetchRevenueData(period: string) {
  try {
    // Optimized query with proper ordering and limits
    const { data, error } = await supabase
      .from("daily_revenue")
      .select("day, revenue, annualized_revenue, updated_at, created_at, query_id")
      .order("day", { ascending: false })

    if (error) {
      return { error: "Failed to fetch revenue data", data: null }
    }

    if (!data || data.length === 0) {
      return {
        data: {
          daily_revenue: 0,
          daily_change: 0,
          annualized_revenue: 0,
          last_updated: new Date().toISOString(),
          historical_daily_revenue: [],
          historical_annualized_revenue: [],
        },
        error: null,
      }
    }

    // Process current metrics
    const sortedRows = data.sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())
    const latestRecord = sortedRows[0]
    const previousRecord = sortedRows.length > 1 ? sortedRows[1] : null

    const currentRevenue = latestRecord.revenue || 0
    let dailyChange = 0

    if (previousRecord) {
      const previousRevenue = previousRecord.revenue || 0
      dailyChange = currentRevenue - previousRevenue
    }

    // Get historical data based on period
    let historicalData = []
    switch (period.toLowerCase()) {
      case "7d":
        historicalData = data.slice(0, 7)
        break
      case "30d":
        historicalData = data.slice(0, 30)
        break
      case "90d":
        historicalData = data.slice(0, 90)
        break
      case "max":
        historicalData = data
        break
      default:
        historicalData = data.slice(0, 7)
    }

    // Sort ascending for chart display
    historicalData = historicalData.sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())

    const historical_daily_revenue = historicalData.map((item) => ({
      date: item.day,
      value: item.revenue || 0,
    }))

    const historical_annualized_revenue = historicalData.map((item) => ({
      date: item.day,
      value: item.annualized_revenue || 0,
    }))

    return {
      data: {
        daily_revenue: currentRevenue,
        daily_change: dailyChange,
        previous_day_revenue: previousRecord ? previousRecord.revenue || 0 : 0,
        annualized_revenue: latestRecord.annualized_revenue || 0,
        last_updated: latestRecord.updated_at || latestRecord.created_at || new Date().toISOString(),
        latest_day: latestRecord.day,
        previous_day: previousRecord ? previousRecord.day : null,
        data_source: latestRecord.query_id === 999999 ? "DeFiLlama" : "Dune",
        historical_daily_revenue,
        historical_annualized_revenue,
      },
      error: null,
    }
  } catch (error) {
    console.error("Revenue data fetch error:", error)
    return { error: "Failed to process revenue data", data: null }
  }
}
