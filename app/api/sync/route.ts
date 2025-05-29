import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    message: "Sync endpoint is working!",
    timestamp: new Date().toISOString(),
    status: "ready",
  })
}

export async function POST() {
  try {
    console.log("🚀 Dune sync started")

    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184492

    if (!duneApiKey) {
      return NextResponse.json({ success: false, error: "DUNE_API_KEY not found" }, { status: 500 })
    }

    // Step 1: Execute the Dune query
    console.log(`📋 Executing Dune query ${queryId}`)

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
        { success: false, error: `Dune execute failed: ${execResponse.status} - ${errorText}` },
        { status: 500 },
      )
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    console.log(`✅ Execution ID: ${executionId}`)

    // Step 2: Poll for results
    let attempts = 0
    const maxAttempts = 20

    while (attempts < maxAttempts) {
      console.log(`🔄 Polling attempt ${attempts + 1}`)

      const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/results`, {
        headers: {
          "X-Dune-Api-Key": duneApiKey,
        },
      })

      if (resultResponse.ok) {
        const data = await resultResponse.json()

        if (data.state === "QUERY_STATE_COMPLETED") {
          const rows = data.result.rows
          console.log(`✅ Query completed! ${rows.length} rows`)

          return NextResponse.json({
            success: true,
            execution_id: executionId,
            total_rows: rows.length,
            sample_row: rows[0],
            first_few_rows: rows.slice(0, 3),
            message: `Successfully fetched ${rows.length} rows`,
          })
        } else if (data.state === "QUERY_STATE_FAILED") {
          return NextResponse.json({ success: false, error: "Query execution failed" }, { status: 500 })
        }
      }

      attempts++
      await new Promise((r) => setTimeout(r, 2000))
    }

    return NextResponse.json({ success: false, error: "Query timed out" }, { status: 500 })
  } catch (error) {
    console.error("❌ Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
