import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get all data ordered by date
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

      // Debug logging
      console.log("Latest record address_count:", latestRecord.address_count)
      console.log("Previous record address_count:", previousRecord.address_count)
      console.log("Calculated daily_new_wallets:", daily_new_wallets)
    } else {
      // If we only have one record, use its address_count as the change
      daily_new_wallets = latestRecord.address_count || 0
      console.log("Only one record found, using address_count as daily_new_wallets:", daily_new_wallets)
    }

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
      debug: {
        latest_address_count: latestRecord.address_count,
        previous_address_count: previousRecord?.address_count,
        raw_daily_new_wallets: daily_new_wallets,
      },
    }

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
