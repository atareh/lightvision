import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("dune_executions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to fetch execution status" }, { status: 500 })
    }

    return NextResponse.json({ executions: data || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
