import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get the latest few records to see what data we have
    const { data: metrics, error } = await supabase
      .from("memes_metrics")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(5)

    if (error) {
      console.error("Error fetching memes metrics:", error)
      return NextResponse.json({ error: "Failed to fetch memes metrics" }, { status: 500 })
    }

    // Also get the oldest record
    const { data: oldestMetrics, error: oldestError } = await supabase
      .from("memes_metrics")
      .select("*")
      .order("recorded_at", { ascending: true })
      .limit(1)

    if (oldestError) {
      console.error("Error fetching oldest metrics:", oldestError)
      return NextResponse.json({ error: "Failed to fetch oldest metrics" }, { status: 500 })
    }

    const latest = metrics?.[0]
    const oldest = oldestMetrics?.[0]

    // Calculate the changes
    const marketCapChange = latest && oldest ? latest.total_market_cap - oldest.total_market_cap : null
    const volumeChange = latest && oldest ? latest.total_volume_24h - oldest.total_volume_24h : null
    const visibleMarketCapChange =
      latest && oldest ? (latest.visible_market_cap || 0) - (oldest.visible_market_cap || 0) : null
    const visibleVolumeChange =
      latest && oldest ? (latest.visible_volume_24h || 0) - (oldest.visible_volume_24h || 0) : null

    return NextResponse.json({
      debug: {
        totalRecords: metrics?.length || 0,
        latestRecord: latest,
        oldestRecord: oldest,
        calculations: {
          marketCapChange,
          volumeChange,
          visibleMarketCapChange,
          visibleVolumeChange,
        },
        visibleDataCheck: {
          latestHasVisibleData: !!(latest?.visible_market_cap && latest?.visible_volume_24h),
          oldestHasVisibleData: !!(oldest?.visible_market_cap && oldest?.visible_volume_24h),
        },
      },
      recentMetrics: metrics,
    })
  } catch (error) {
    console.error("Error in debug memes metrics API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
