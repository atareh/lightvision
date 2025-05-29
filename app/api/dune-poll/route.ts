import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { execution_id } = await request.json()

    if (!execution_id) {
      return NextResponse.json({ error: "execution_id required" }, { status: 400 })
    }

    console.log(`🔄 Starting extended polling for execution: ${execution_id}`)

    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      return NextResponse.json({ error: "DUNE_API_KEY not found" }, { status: 500 })
    }

    // Check if already completed
    const { data: existingExecution } = await supabase
      .from("dune_executions")
      .select("status, completed_at")
      .eq("execution_id", execution_id)
      .single()

    if (existingExecution?.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        execution_id,
        message: "Query already completed",
        status: "COMPLETED",
      })
    }

    // Use longer intervals for extended polling
    const delays = [10, 30, 60, 120, 180, 300, 300, 300, 300, 300] // seconds
    let attempt = 0

    for (const delay of delays) {
      attempt++
      console.log(`🔄 Extended polling attempt ${attempt}/${delays.length} (waiting ${delay}s)`)

      // Wait before polling (except first attempt)
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, delay * 1000))
      }

      try {
        const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/results`, {
          headers: {
            "X-Dune-Api-Key": duneApiKey,
          },
        })

        if (resultResponse.ok) {
          const data = await resultResponse.json()
          console.log(`📊 State: ${data.state}`)

          // Update status in database
          await supabase
            .from("dune_executions")
            .update({
              status: data.state,
              updated_at: new Date().toISOString(),
            })
            .eq("execution_id", execution_id)

          if (data.state === "QUERY_STATE_COMPLETED") {
            const rows = data.result.rows
            console.log(`✅ Query completed! ${rows.length} rows`)

            // Process and store results
            await processAndStoreResults(rows, execution_id)

            // Mark as completed
            await supabase
              .from("dune_executions")
              .update({
                status: "COMPLETED",
                row_count: rows.length,
                completed_at: new Date().toISOString(),
              })
              .eq("execution_id", execution_id)

            return NextResponse.json({
              success: true,
              execution_id,
              total_rows: rows.length,
              message: `Successfully processed ${rows.length} rows`,
            })
          } else if (data.state === "QUERY_STATE_FAILED") {
            await supabase
              .from("dune_executions")
              .update({
                status: "FAILED",
                error_message: "Query execution failed",
                completed_at: new Date().toISOString(),
              })
              .eq("execution_id", execution_id)

            return NextResponse.json({ success: false, error: "Query execution failed" }, { status: 500 })
          }
        }
      } catch (pollError) {
        console.error(`❌ Polling error on attempt ${attempt}:`, pollError)
        // Continue to next attempt
      }
    }

    // If we get here, we've exhausted all attempts
    await supabase
      .from("dune_executions")
      .update({
        status: "TIMEOUT",
        error_message: "Extended polling timed out after all attempts",
        completed_at: new Date().toISOString(),
      })
      .eq("execution_id", execution_id)

    return NextResponse.json({ success: false, error: "Query timed out after all polling attempts" }, { status: 500 })
  } catch (error) {
    console.error("❌ Extended polling error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

async function processAndStoreResults(rows: any[], executionId: string) {
  console.log("💾 Processing and storing results...")

  for (const row of rows) {
    try {
      const blockDay = row.block_day ? new Date(row.block_day).toISOString().split("T")[0] : null

      if (!blockDay) {
        console.log("⚠️ Skipping row with no block_day")
        continue
      }

      // Check if a record for this date already exists
      const { data: existingRecord, error: selectError } = await supabase
        .from("dune_results")
        .select("id")
        .eq("block_day", blockDay)
        .single()

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking existing record:", selectError)
        continue
      }

      const recordData = {
        execution_id: executionId,
        query_id: 5184581,
        block_day: blockDay,
        address_count: row.address_count ? Number.parseInt(row.address_count) : null,
        deposit: row.deposit ? Number.parseFloat(row.deposit) : null,
        withdraw: row.withdraw ? Number.parseFloat(row.withdraw) : null,
        netflow: row.netflow ? Number.parseFloat(row.netflow) : null,
        total_wallets: row.address_count ? Number.parseInt(row.address_count) : null,
        tvl: row.TVL ? Number.parseFloat(row.TVL) : null,
        updated_at: new Date().toISOString(),
      }

      if (existingRecord) {
        console.log(`🔄 Updating existing record for ${blockDay}`)
        const { error: updateError } = await supabase
          .from("dune_results")
          .update(recordData)
          .eq("id", existingRecord.id)

        if (updateError) {
          console.error("Error updating record:", updateError)
        } else {
          console.log(`✅ Updated record for ${blockDay}`)
        }
      } else {
        console.log(`➕ Inserting new record for ${blockDay}`)
        recordData.created_at = new Date().toISOString()

        const { error: insertError } = await supabase.from("dune_results").insert([recordData])

        if (insertError) {
          console.error("Error inserting record:", insertError)
        } else {
          console.log(`✅ Inserted new record for ${blockDay}`)
        }
      }
    } catch (error) {
      console.error("Error processing row:", error, row)
    }
  }

  console.log("🎉 Finished processing all rows")
}
