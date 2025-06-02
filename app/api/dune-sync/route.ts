import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST() {
  try {
    console.log("🚀 Starting Dune sync process...")

    const queryIdToExecute = 5184581 // This endpoint is hardcoded for this query ID.

    if (queryIdToExecute === 5184581) {
      const message =
        "Query 5184581 is now handled by webhook. Manual trigger via this endpoint is deprecated for this query."
      console.log(`⚠️ ${message}`)
      return NextResponse.json({ success: false, error: message, status: "DEPRECATED_WEBHOOK_ACTIVE" }, { status: 400 })
    }

    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184581

    console.log("🔑 Checking API key:", duneApiKey ? "Found" : "Missing")
    console.log("📋 Query ID:", queryId)

    if (!duneApiKey) {
      console.error("❌ DUNE_API_KEY not found")
      return NextResponse.json({ success: false, error: "DUNE_API_KEY not found" }, { status: 500 })
    }

    // Step 1: Execute the Dune query
    console.log(`📋 Executing Dune query ${queryId}`)

    let execResponse
    try {
      execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
        method: "POST",
        headers: {
          "X-Dune-Api-Key": duneApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ performance: "medium" }),
      })
    } catch (fetchError) {
      console.error("❌ Fetch error:", fetchError)
      return NextResponse.json({ success: false, error: `Network error: ${fetchError.message}` }, { status: 500 })
    }

    console.log("📡 Response status:", execResponse.status)

    if (!execResponse.ok) {
      const errorText = await execResponse.text()
      return NextResponse.json(
        { success: false, error: `Dune execute failed: ${execResponse.status} - ${errorText}` },
        { status: 500 },
      )
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    console.log(`✅ Execution ID: ${executionId}`)

    // Step 2: Store the execution ID for background polling
    console.log(`💾 Storing execution ID in database...`)
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
      console.error("❌ Error storing execution ID:", insertError)
      return NextResponse.json(
        { success: false, error: `Failed to store execution: ${insertError.message}` },
        { status: 500 },
      )
    }

    console.log(`✅ Stored in database:`, insertedData)

    // Verify it was stored by reading it back
    const { data: verifyData, error: verifyError } = await supabase
      .from("dune_executions")
      .select("*")
      .eq("execution_id", executionId)
      .single()

    if (verifyError) {
      console.error("❌ Error verifying storage:", verifyError)
    } else {
      console.log(`✅ Verified storage:`, verifyData)
    }

    // Return immediately - no polling!
    console.log("✅ Query triggered successfully - will be processed by background polling")

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: "Query triggered successfully. Results will be processed in background.",
      status: "TRIGGERED",
      stored_record: insertedData?.[0] || null,
    })
  } catch (error) {
    console.error("❌ Unexpected error in dune-sync:", error)
    console.error("❌ Error stack:", error.stack)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : "No stack trace available",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Dune sync endpoint is ready. Use POST to trigger sync.",
    query_id: 5184581,
    timestamp: new Date().toISOString(),
  })
}
