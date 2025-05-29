import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get all executions
    const { data: allExecutions, error: allError } = await supabase
      .from("dune_executions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (allError) {
      throw new Error(`Failed to fetch executions: ${allError.message}`)
    }

    // Get pending executions
    const { data: pendingExecutions, error: pendingError } = await supabase
      .from("dune_executions")
      .select("*")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })

    if (pendingError) {
      throw new Error(`Failed to fetch pending executions: ${pendingError.message}`)
    }

    return NextResponse.json({
      total_executions: allExecutions?.length || 0,
      pending_executions: pendingExecutions?.length || 0,
      all_executions: allExecutions || [],
      pending_executions_detail: pendingExecutions || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Debug executions error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
