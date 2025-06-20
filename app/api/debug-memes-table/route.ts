import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic to prevent caching
export const dynamic = "force-dynamic"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    // Check what the API can actually see
    const { data: allRecords, error: allError } = await supabase
      .from("memes_metrics")
      .select("id, recorded_at, created_at, total_market_cap, visible_market_cap")
      .order("recorded_at", { ascending: false })
      .limit(20)

    if (allError) {
      console.error("Error fetching memes metrics for debug:", allError)
      return NextResponse.json(
        {
          error: "Failed to fetch memes metrics",
          details: allError.message,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        { status: 500 },
      )
    }

    // Get count and date range
    const { count, error: countError } = await supabase
      .from("memes_metrics")
      .select("*", { count: "exact", head: true })

    const summary = {
      totalRecords: count || 0,
      recordsReturned: allRecords?.length || 0,
      latestRecord: allRecords?.[0] || null,
      oldestInSample: allRecords?.[allRecords.length - 1] || null,
      hasVisibleData: allRecords?.some((r) => r.visible_market_cap !== null) || false,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      summary,
      records: allRecords,
      countError: countError?.message || null,
    })
  } catch (error) {
    console.error("Debug memes table error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
