import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Opt out of caching for this route
export const dynamic = "force-dynamic"
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  // Add request parameter
  try {
    // Get all memes metrics data ordered by time
    const { data: metrics, error } = await supabase
      .from("memes_metrics")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(2000)

    if (error) {
      console.error("Error fetching memes metrics:", error)
      return NextResponse.json({ error: "Failed to fetch memes metrics" }, { status: 500 })
    }

    if (!metrics || metrics.length === 0) {
      console.log("No metrics found in database")
      return NextResponse.json({
        metrics: [],
        marketCapChange: null,
        volumeChange: null,
        visibleMarketCapChange: null,
        visibleVolumeChange: null,
        last_updated: new Date().toISOString(), // Ensure this is dynamic
      })
    }

    // Get the latest record
    const latest = metrics[0]

    // Find record from ~24 hours ago (not the oldest ever)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Find the closest record to 24 hours ago
    let record24hAgo = null
    let minTimeDiff = Number.POSITIVE_INFINITY

    for (const metric of metrics) {
      const recordTime = new Date(metric.recorded_at)
      const timeDiff = Math.abs(recordTime.getTime() - twentyFourHoursAgo.getTime())

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff
        record24hAgo = metric
      }
    }

    // Remove these two console.log blocks:
    // console.log("Debug memes metrics 24h calculation:", {
    //   totalRecords: metrics.length,
    //   latest: {
    //     recorded_at: latest.recorded_at,
    //     total_market_cap: latest.total_market_cap,
    //     visible_market_cap: latest.visible_market_cap,
    //   },
    //   record24hAgo: record24hAgo
    //     ? {
    //         recorded_at: record24hAgo.recorded_at,
    //         total_market_cap: record24hAgo.total_market_cap,
    //         visible_market_cap: record24hAgo.visible_market_cap,
    //         timeDiffHours: minTimeDiff / (1000 * 60 * 60),
    //       }
    //     : null,
    // })

    // Calculate 24h changes (only if we have a record to compare with)
    let marketCapChange = null
    let volumeChange = null
    let visibleMarketCapChange = null
    let visibleVolumeChange = null

    if (record24hAgo && record24hAgo.id !== latest.id) {
      // All tokens metrics (current behavior)
      marketCapChange = latest.total_market_cap - record24hAgo.total_market_cap
      volumeChange = latest.total_volume_24h - record24hAgo.total_volume_24h

      // Visible tokens metrics (new)
      visibleMarketCapChange = (latest.visible_market_cap || 0) - (record24hAgo.visible_market_cap || 0)
      visibleVolumeChange = (latest.visible_volume_24h || 0) - (record24hAgo.visible_volume_24h || 0)
    }

    // AND

    // console.log("Calculated 24h changes:", {
    //   marketCapChange,
    //   volumeChange,
    //   visibleMarketCapChange,
    //   visibleVolumeChange,
    //   hasComparison: record24hAgo && record24hAgo.id !== latest.id,
    // })

    // Use the latest updated_at timestamp from the most recent record if available, otherwise recorded_at
    const lastUpdated = latest.updated_at || latest.recorded_at || new Date().toISOString()

    const response = NextResponse.json({
      metrics,
      marketCapChange,
      volumeChange,
      visibleMarketCapChange,
      visibleVolumeChange,
      latest,
      record24hAgo,
      last_updated: lastUpdated,
    })

    // Add cache-busting headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")

    return response
  } catch (error) {
    console.error("Error in memes metrics API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
