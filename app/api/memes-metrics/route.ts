import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get all memes metrics data ordered by time
    const { data: metrics, error } = await supabase
      .from("memes_metrics")
      .select("*")
      .order("recorded_at", { ascending: true })

    if (error) {
      console.error("Error fetching memes metrics:", error)
      return NextResponse.json({ error: "Failed to fetch memes metrics" }, { status: 500 })
    }

    if (!metrics || metrics.length === 0) {
      return NextResponse.json({
        metrics: [],
        marketCapChange: null,
        volumeChange: null,
        visibleMarketCapChange: null,
        visibleVolumeChange: null,
        last_updated: new Date().toISOString(),
      })
    }

    // Calculate changes between current (latest) and oldest entry
    const oldest = metrics[0]
    const latest = metrics[metrics.length - 1]

    // Calculate changes for all tokens (current behavior)
    const marketCapChange = latest.total_market_cap - oldest.total_market_cap
    const volumeChange = latest.total_volume_24h - oldest.total_volume_24h

    // Calculate changes for visible tokens (new)
    const visibleMarketCapChange = latest.visible_market_cap - (oldest.visible_market_cap || 0)
    const visibleVolumeChange = latest.visible_volume_24h - (oldest.visible_volume_24h || 0)

    // Use the latest updated_at timestamp from the most recent record
    const lastUpdated = latest.updated_at || latest.recorded_at || new Date().toISOString()

    return NextResponse.json({
      metrics,
      // All tokens metrics (current behavior)
      marketCapChange,
      volumeChange,
      // Visible tokens metrics (new)
      visibleMarketCapChange,
      visibleVolumeChange,
      oldest,
      latest,
      last_updated: lastUpdated,
    })
  } catch (error) {
    console.error("Error in memes metrics API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
