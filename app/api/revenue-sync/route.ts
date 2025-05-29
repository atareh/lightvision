import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST() {
  try {
    console.log("🚀 Starting Revenue sync process...")

    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184711

    if (!duneApiKey) {
      return NextResponse.json({ success: false, error: "DUNE_API_KEY not found" }, { status: 500 })
    }

    // Execute the Dune query
    console.log(`📋 Executing Revenue query ${queryId}`)

    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    if (!execResponse.ok) {
      const errorText = await execResponse.text()
      return NextResponse.json(
        { success: false, error: `Revenue execute failed: ${execResponse.status} - ${errorText}` },
        { status: 500 },
      )
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    console.log(`✅ Revenue Execution ID: ${executionId}`)

    // Store the execution for background polling
    console.log(`💾 Storing Revenue execution ID in database...`)
    const { data: insertedData, error: insertError } = await supabase
      .from("dune_executions")
      .insert([
        {
          execution_id: executionId,
          query_id: queryId,
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (insertError) {
      console.error(`❌ Failed to store execution ID:`, insertError)
    } else {
      console.log(`✅ Stored in database:`, insertedData)
    }

    // Return immediately - no polling!
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: "Revenue query triggered successfully. Results will be processed in background.",
      status: "TRIGGERED",
    })
  } catch (error) {
    console.error("❌ Revenue sync error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Revenue sync endpoint is ready. Use POST to trigger sync.",
    query_id: 5184711,
    timestamp: new Date().toISOString(),
  })
}
