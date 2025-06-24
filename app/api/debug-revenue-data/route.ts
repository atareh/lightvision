import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get("password")

    // Simple password check
    if (password !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the latest 10 records from daily_revenue table
    const { data: revenueData, error: revenueError } = await supabase
      .from("daily_revenue")
      .select("*")
      .order("day", { ascending: false })
      .limit(10)

    if (revenueError) {
      console.error("Error fetching revenue data:", revenueError)
    }

    // Get table info
    const { data: tableInfo, error: tableError } = await supabase.from("daily_revenue").select("*").limit(1)

    // Count total records
    const { count, error: countError } = await supabase
      .from("daily_revenue")
      .select("*", { count: "exact", head: true })

    return NextResponse.json({
      success: true,
      debug_info: {
        total_records: count,
        latest_10_records: revenueData,
        table_structure: tableInfo?.[0] ? Object.keys(tableInfo[0]) : [],
        errors: {
          revenue_error: revenueError?.message || null,
          table_error: tableError?.message || null,
          count_error: countError?.message || null,
        },
      },
    })
  } catch (error) {
    console.error("Debug API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
