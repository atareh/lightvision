import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Use anon key for reads
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function GET() {
  try {
    // Get all HyperEVM data ordered by date (descending to get most recent first)
    const { data, error } = await supabase
      .from("hyperevm_protocols")
      .select("day,protocol_name,daily_tvl,total_daily_tvl,created_at,updated_at")
      .order("day", { ascending: false })
      .order("protocol_name", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          error:
            "Failed to fetch HyperEVM data from database. Please sync first using POST /api/cron/hyperevm-sync-llama",
        },
        { status: 500 },
      )
    }

    console.log(`Fetched ${data?.length || 0} records from database`)

    if (!data || data.length === 0) {
      return NextResponse.json({
        current_tvl: 0,
        daily_change: 0,
        protocols: [],
        historical_data: [],
        last_updated: new Date().toISOString(),
        error: "No HyperEVM data found. Please sync first using POST /api/cron/hyperevm-sync-llama",
      })
    }

    // Debug: Log the unique days and protocol counts
    const uniqueDays = [...new Set(data.map((row) => row.day))].sort().reverse()
    console.log(`Unique days in database: ${uniqueDays.join(", ")}`)

    for (const day of uniqueDays.slice(0, 3)) {
      const protocolsForDay = data.filter((row) => row.day === day)
      console.log(`Day ${day}: ${protocolsForDay.length} protocols`)
    }

    // Process the data to calculate metrics AND return historical data
    const processedData = processHyperEVMData(data)

    return NextResponse.json(processedData)
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

// Update the processHyperEVMData function to properly structure historical data

function processHyperEVMData(rows: any[]) {
  if (!rows || rows.length === 0) {
    return {
      current_tvl: 0,
      daily_change: 0,
      protocols: [],
      historical_data: [],
      last_updated: new Date().toISOString(),
    }
  }

  // Group data by day
  const dataByDay = rows.reduce((acc, row) => {
    const day = row.day
    if (!acc[day]) {
      acc[day] = {
        date: day,
        total: 0,
        protocols: {},
      }
    }

    // Add this protocol's TVL to the day's data
    acc[day].protocols[row.protocol_name] = row.daily_tvl || 0

    // Update total TVL for the day (we'll recalculate this to ensure accuracy)
    acc[day].total += row.daily_tvl || 0

    return acc
  }, {})

  // Get sorted days (most recent first for metrics, chronological for chart)
  const sortedDays = Object.keys(dataByDay).sort()
  const reverseSortedDays = [...sortedDays].reverse()

  console.log(`Processed days: ${sortedDays.join(", ")}`)

  if (sortedDays.length === 0) {
    return {
      current_tvl: 0,
      daily_change: 0,
      protocols: [],
      historical_data: [],
      last_updated: new Date().toISOString(),
    }
  }

  const latestDay = reverseSortedDays[0]
  const previousDay = reverseSortedDays.length > 1 ? reverseSortedDays[1] : null

  const currentData = dataByDay[latestDay]
  const previousData = previousDay ? dataByDay[previousDay] : null

  console.log(`Latest day: ${latestDay}, protocols: ${Object.keys(currentData.protocols).length}`)
  console.log(
    `Previous day: ${previousDay}, protocols: ${previousData ? Object.keys(previousData.protocols).length : 0}`,
  )

  // Calculate current TVL (sum of all protocols for latest day)
  const currentTVL = currentData.total

  // Calculate daily change using two most recent complete days
  let dailyChange = 0
  if (previousData) {
    dailyChange = currentTVL - previousData.total
  }

  // Format protocols for the API response
  const protocolsList = Object.entries(currentData.protocols)
    .map(([name, tvl]) => ({
      name,
      tvl,
    }))
    .sort((a, b) => (b.tvl as number) - (a.tvl as number))

  // Create historical data array (chronological order)
  const historicalData = sortedDays.map((day) => dataByDay[day])

  return {
    current_tvl: currentTVL,
    daily_change: dailyChange,
    previous_day_tvl: previousData ? previousData.total : 0,
    protocols: protocolsList,
    historical_data: historicalData,
    last_updated: new Date().toISOString(),
    latest_day: latestDay,
    previous_day: previousDay,
    data_source: "llama_api",
    debug_info: {
      total_records: rows.length,
      unique_days: sortedDays.length,
      protocols_latest_day: Object.keys(currentData.protocols).length,
    },
  }
}
