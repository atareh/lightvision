import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period")

    // Get all data ordered by date - KEEPING ORIGINAL ORDERING
    const { data, error } = await supabase.from("dune_results").select("*").order("block_day", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch data from database. Please sync first using POST /api/dune-sync",
        },
        { status: 500 },
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          error: "No data found. Please sync first using POST /api/dune-sync",
        },
        { status: 404 },
      )
    }

    // KEEPING ORIGINAL CALCULATION LOGIC
    // Calculate metrics using two most recent complete days logic
    const latestRecord = data[data.length - 1]
    const previousRecord = data.length > 1 ? data[data.length - 2] : null

    // Total wallets = sum of all address_count values
    const total_wallets = data.reduce((sum, record) => sum + (record.address_count || 0), 0)

    // TVL = sum of all netflow values
    const tvl = data.reduce((sum, record) => sum + (record.netflow || 0), 0)

    // Calculate 24h changes using two most recent complete days
    let daily_new_wallets = 0
    let tvl_change = 0

    if (previousRecord) {
      // Calculate wallet growth between the two most recent days
      daily_new_wallets = (latestRecord.address_count || 0) - (previousRecord.address_count || 0)

      // Calculate TVL change between the two most recent days
      tvl_change = (latestRecord.netflow || 0) - (previousRecord.netflow || 0)
    } else {
      // If we only have one record, use its address_count as the change
      daily_new_wallets = latestRecord.address_count || 0
    }

    // Base metrics object - KEEPING ORIGINAL STRUCTURE
    const metrics = {
      total_wallets,
      tvl,
      netflow: latestRecord.netflow || 0,
      daily_new_wallets: Math.abs(daily_new_wallets),
      wallet_growth: Math.abs(daily_new_wallets),
      tvl_change,
      // Add previous day actual values
      previous_day_tvl: previousRecord?.netflow || 0,
      previous_day_wallets: previousRecord?.address_count || 0,
      last_updated: latestRecord.updated_at || latestRecord.created_at,
      total_rows_in_db: data.length,
      execution_id: latestRecord.execution_id,
      // Add the latest day's address_count directly
      address_count: latestRecord.address_count || 0,
    }

    // If period is specified, add historical data
    if (period) {
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

      // Filter data for the specified period
      const periodData = data.filter((item) => {
        const itemDate = new Date(item.block_day)
        return itemDate >= startDate
      })

      // Calculate CUMULATIVE TVL and wallets for each day (running totals from beginning of time)
      const historical_tvl = []
      const historical_wallets = []

      let cumulativeTvl = 0
      let cumulativeWallets = 0

      // First, calculate cumulative totals up to the start of our period
      const preStartData = data.filter((item) => {
        const itemDate = new Date(item.block_day)
        return itemDate < startDate
      })

      preStartData.forEach((item) => {
        cumulativeTvl += item.netflow || 0
        cumulativeWallets += item.address_count || 0
      })

      // Now add the period data with daily values (not cumulative)
      periodData.forEach((item) => {
        cumulativeTvl += item.netflow || 0
        cumulativeWallets += item.address_count || 0

        // Format the date as YYYY-MM-DD to ensure consistency
        const dateObj = new Date(item.block_day)
        const formattedDate = dateObj.toISOString().split("T")[0]

        historical_tvl.push({
          date: formattedDate,
          value: cumulativeTvl,
        })

        historical_wallets.push({
          date: formattedDate,
          value: item.address_count || 0, // ← Use daily value, not cumulative!
          cumulative: cumulativeWallets, // ← Add cumulative as separate field
        })
      })

      // Add historical data to metrics
      return NextResponse.json({
        ...metrics,
        historical_tvl,
        historical_wallets,
      })
    }

    // Return just the base metrics if no period specified
    return NextResponse.json(metrics)
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
