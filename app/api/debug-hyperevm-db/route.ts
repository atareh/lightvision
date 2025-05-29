import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function GET() {
  try {
    // Get all data from the table
    const { data, error } = await supabase
      .from("hyperevm_protocols")
      .select("*")
      .order("day", { ascending: false })
      .order("protocol_name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by day for analysis
    const byDay =
      data?.reduce(
        (acc, row) => {
          if (!acc[row.day]) {
            acc[row.day] = []
          }
          acc[row.day].push(row)
          return acc
        },
        {} as Record<string, any[]>,
      ) || {}

    const summary = Object.entries(byDay).map(([day, protocols]) => ({
      day,
      protocol_count: protocols.length,
      total_tvl: protocols.reduce((sum, p) => sum + (p.daily_tvl || 0), 0),
      protocols: protocols.map((p) => ({ name: p.protocol_name, tvl: p.daily_tvl })),
    }))

    return NextResponse.json({
      total_records: data?.length || 0,
      unique_days: Object.keys(byDay).length,
      summary: summary.slice(0, 5), // Show last 5 days
      raw_data: data?.slice(0, 20), // Show first 20 records for debugging
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
