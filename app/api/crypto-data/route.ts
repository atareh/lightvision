import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    // Get the latest CMC data from database
    const { data: cmcData, error } = await supabase
      .from("cmc_data")
      .select("*")
      .eq("symbol", "HYPE")
      .order("synced_at", { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!cmcData || cmcData.length === 0) {
      throw new Error("No CMC data found in database")
    }

    const latestData = cmcData[0]

    // Check if data is stale (older than 10 minutes)
    const dataAge = Date.now() - new Date(latestData.synced_at).getTime()
    const isStale = dataAge > 10 * 60 * 1000 // 10 minutes

    // Format response to match the original structure
    const response = {
      hype: {
        price: Number.parseFloat(latestData.price),
        market_cap: Number.parseInt(latestData.market_cap),
        percent_change_24h: Number.parseFloat(latestData.percent_change_24h),
        fully_diluted_market_cap: Number.parseInt(latestData.fully_diluted_market_cap),
        volume_24h: Number.parseInt(latestData.volume_24h),
        volume_change_24h: Number.parseFloat(latestData.volume_change_24h),
      },
      meta: {
        synced_at: latestData.synced_at,
        data_age_minutes: Math.round(dataAge / (1000 * 60)),
        is_stale: isStale,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ Error fetching crypto data:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch crypto data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
