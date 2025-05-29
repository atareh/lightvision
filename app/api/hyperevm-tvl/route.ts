import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get all HyperEVM data ordered by date
    const { data, error } = await supabase.from("hyperevm_protocols").select("*").order("day", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch HyperEVM data from database. Please sync first using POST /api/hyperevm-sync",
        },
        { status: 500 },
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        current_tvl: 0,
        daily_change: 0,
        protocols: [],
        last_updated: new Date().toISOString(),
        error: "No HyperEVM data found. Please sync first using POST /api/hyperevm-sync",
      })
    }

    // Process the data to calculate metrics
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

function processHyperEVMData(rows: any[]) {
  if (!rows || rows.length === 0) {
    return {
      current_tvl: 0,
      daily_change: 0,
      protocols: [],
      last_updated: new Date().toISOString(),
    }
  }

  // Group data by day
  const dataByDay = rows.reduce((acc, row) => {
    const day = row.day
    if (!acc[day]) {
      acc[day] = {
        total_daily_tvl: row.total_daily_tvl,
        protocols: [],
      }
    }
    acc[day].protocols.push({
      name: row.protocol_name,
      tvl: row.daily_tvl,
    })
    return acc
  }, {})

  // Get sorted days
  const sortedDays = Object.keys(dataByDay).sort()

  if (sortedDays.length === 0) {
    return {
      current_tvl: 0,
      daily_change: 0,
      protocols: [],
      last_updated: new Date().toISOString(),
    }
  }

  const latestDay = sortedDays[sortedDays.length - 1]
  const previousDay = sortedDays.length > 1 ? sortedDays[sortedDays.length - 2] : null

  const currentData = dataByDay[latestDay]
  const previousData = previousDay ? dataByDay[previousDay] : null

  // Calculate current TVL (sum of all protocols for latest day)
  const currentTVL = currentData.protocols.reduce((sum, protocol) => sum + (protocol.tvl || 0), 0)

  // Calculate daily change using two most recent complete days
  let dailyChange = 0
  if (previousData) {
    const previousTVL = previousData.protocols.reduce((sum, protocol) => sum + (protocol.tvl || 0), 0)
    dailyChange = currentTVL - previousTVL
  }

  const previousTVL = previousData ? previousData.protocols.reduce((sum, protocol) => sum + (protocol.tvl || 0), 0) : 0

  return {
    current_tvl: currentTVL,
    daily_change: dailyChange,
    previous_day_tvl: previousTVL,
    protocols: currentData.protocols.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)), // Sort by TVL descending
    last_updated: new Date().toISOString(),
    latest_day: latestDay,
    previous_day: previousDay,
  }
}
