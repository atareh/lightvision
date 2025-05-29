import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Add this helper function at the top
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  try {
    // SECURITY: Require authentication
    const debugPassword = request.headers.get("x-debug-password")

    if (debugPassword !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { execution_ids, force = false } = await request.json()

    if (!execution_ids || !Array.isArray(execution_ids)) {
      return NextResponse.json({ error: "execution_ids array required" }, { status: 400 })
    }

    console.log(`🔧 Manual processing requested for: ${execution_ids.join(", ")}`)
    if (force) {
      console.log(`⚡ Force mode enabled - will reprocess already processed executions`)
    }

    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      return NextResponse.json({ error: "DUNE_API_KEY not found" }, { status: 500 })
    }

    const results = []

    for (const executionId of execution_ids) {
      try {
        console.log(`🔍 Processing execution: ${executionId}`)

        // Get execution details from our database
        const { data: execution, error: dbError } = await supabase
          .from("dune_executions")
          .select("*")
          .eq("execution_id", executionId)
          .single()

        if (dbError || !execution) {
          console.log(`❌ Execution not found in database: ${executionId}`)
          results.push({ execution_id: executionId, success: false, error: "Not found in database" })
          continue
        }

        if (execution.processed && !force) {
          console.log(`⚠️ Execution already processed: ${executionId}`)
          results.push({ execution_id: executionId, success: false, error: "Already processed" })
          continue
        }

        if (execution.processed && force) {
          console.log(`⚡ Force reprocessing execution: ${executionId}`)
        }

        // Fetch results from Dune API
        const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/results`, {
          headers: {
            "X-Dune-Api-Key": duneApiKey,
          },
        })

        if (!resultResponse.ok) {
          console.log(`❌ Failed to fetch results for ${executionId}: ${resultResponse.status}`)
          results.push({ execution_id: executionId, success: false, error: `API error: ${resultResponse.status}` })
          continue
        }

        const data = await resultResponse.json()

        if (data.state !== "QUERY_STATE_COMPLETED") {
          console.log(`❌ Query not completed: ${executionId} (${data.state})`)
          results.push({ execution_id: executionId, success: false, error: `Query state: ${data.state}` })
          continue
        }

        const rows = data.result.rows
        console.log(`📊 Found ${rows.length} rows for execution ${executionId}`)

        // Process and store results based on query type
        await processAndStoreResults(execution.query_id, rows, executionId)

        // Mark as processed
        await supabase
          .from("dune_executions")
          .update({
            processed: true,
            row_count: rows.length,
            updated_at: new Date().toISOString(),
          })
          .eq("execution_id", executionId)

        console.log(`✅ Successfully processed execution: ${executionId}`)
        // Add delay between executions to avoid rate limits
        if (execution_ids.indexOf(executionId) < execution_ids.length - 1) {
          console.log(`⏳ Waiting 2 seconds before next execution...`)
          await delay(2000)
        }
        results.push({
          execution_id: executionId,
          success: true,
          rows_processed: rows.length,
          query_id: execution.query_id,
        })
      } catch (error) {
        console.error(`❌ Error processing execution ${executionId}:`, error)
        results.push({
          execution_id: executionId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: successCount > 0,
      message: `Processed ${successCount}/${execution_ids.length} executions successfully`,
      success_count: successCount,
      fail_count: failCount,
      results,
    })
  } catch (error) {
    console.error("❌ Manual processing error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// [Include all the existing helper functions - processAndStoreResults, etc.]
async function processAndStoreResults(queryId: number, rows: any[], executionId: string) {
  console.log(`💾 Processing and storing results for query ${queryId}...`)

  if (queryId === 5184581) {
    await processAndStoreDuneResults(rows, executionId)
  } else if (queryId === 5184111) {
    await processAndStoreHyperEVMResults(rows, executionId)
  } else if (queryId === 5184711) {
    await processAndStoreRevenueResults(rows, executionId)
  }
}

async function processAndStoreDuneResults(rows: any[], executionId: string) {
  console.log(`💾 Processing ${rows.length} Dune results...`)
  for (const row of rows) {
    try {
      const blockDay = row.block_day ? new Date(row.block_day).toISOString().split("T")[0] : null

      if (!blockDay) {
        console.log("⚠️ Skipping row with no block_day")
        continue
      }

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
        await supabase.from("dune_results").update(recordData).eq("id", existingRecord.id)
        await delay(500) // Add 500ms delay
      } else {
        console.log(`➕ Inserting new record for ${blockDay}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("dune_results").insert([recordData])
        await delay(500) // Add 500ms delay
      }
    } catch (error) {
      console.error("Error processing Dune row:", error, row)
    }
  }
  console.log(`✅ Finished processing Dune results`)
}

async function processAndStoreHyperEVMResults(rows: any[], executionId: string) {
  console.log(`💾 Processing ${rows.length} HyperEVM results...`)
  for (const row of rows) {
    try {
      const day = row.day ? new Date(row.day).toISOString().split("T")[0] : null

      if (!day || !row.protocol_name) {
        console.log("⚠️ Skipping row with missing day or protocol_name")
        continue
      }

      const { data: existingRecord, error: selectError } = await supabase
        .from("hyperevm_protocols")
        .select("id")
        .eq("day", day)
        .eq("protocol_name", row.protocol_name)
        .single()

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking existing HyperEVM record:", selectError)
        continue
      }

      const recordData = {
        execution_id: executionId,
        query_id: 5184111,
        day: day,
        protocol_name: row.protocol_name,
        daily_tvl: row.daily_tvl ? Number.parseFloat(row.daily_tvl) : null,
        total_daily_tvl: row.total_daily_tvl ? Number.parseFloat(row.total_daily_tvl) : null,
        updated_at: new Date().toISOString(),
      }

      if (existingRecord) {
        console.log(`🔄 Updating existing HyperEVM record for ${day} - ${row.protocol_name}`)
        await supabase.from("hyperevm_protocols").update(recordData).eq("id", existingRecord.id)
        await delay(500) // Add 500ms delay
      } else {
        console.log(`➕ Inserting new HyperEVM record for ${day} - ${row.protocol_name}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("hyperevm_protocols").insert([recordData])
        await delay(500) // Add 500ms delay
      }
    } catch (error) {
      console.error("Error processing HyperEVM row:", error, row)
    }
  }
  console.log(`✅ Finished processing HyperEVM results`)
}

async function processAndStoreRevenueResults(rows: any[], executionId: string) {
  console.log(`💾 Processing ${rows.length} revenue results...`)
  for (const row of rows) {
    try {
      const day = row.day ? new Date(row.day).toISOString().split("T")[0] : null

      if (!day) {
        console.log("⚠️ Skipping row with missing day")
        continue
      }

      const { data: existingRecord, error: selectError } = await supabase
        .from("daily_revenue")
        .select("id")
        .eq("day", day)
        .single()

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking existing revenue record:", selectError)
        continue
      }

      const recordData = {
        execution_id: executionId,
        query_id: 5184711,
        day: day,
        revenue: row.revenue ? Number.parseFloat(row.revenue) : null,
        annualized_revenue: row.annualized_revenue ? Number.parseFloat(row.annualized_revenue) : null,
        updated_at: new Date().toISOString(),
      }

      if (existingRecord) {
        console.log(`🔄 Updating existing revenue record for ${day}`)
        await supabase.from("daily_revenue").update(recordData).eq("id", existingRecord.id)
        await delay(500) // Add 500ms delay
      } else {
        console.log(`➕ Inserting new revenue record for ${day}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("daily_revenue").insert([recordData])
        await delay(500) // Add 500ms delay
      }
    } catch (error) {
      console.error("Error processing revenue row:", error, row)
    }
  }
  console.log(`✅ Finished processing revenue results`)
}
