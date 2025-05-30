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
      })
    }

    // Calculate changes between current (latest) and oldest entry
    const oldest = metrics[0]
    const latest = metrics[metrics.length - 1]

    const marketCapChange = latest.total_market_cap - oldest.total_market_cap
    const volumeChange = latest.total_volume_24h - oldest.total_volume_24h

    return NextResponse.json({
      metrics,
      marketCapChange,
      volumeChange,
      oldest,
      latest,
    })
  } catch (error) {
    console.error("Error in memes metrics API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
