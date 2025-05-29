import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const executionId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  try {
    // Verify this is actually a cron request from Vercel
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`🔄 [${executionId}] Polling Dune results...`)

    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      throw new Error("DUNE_API_KEY not found")
    }

    // Get all NON-TERMINAL executions (anything that's not COMPLETED or FAILED)
    const { data: pendingExecutions, error: fetchError } = await supabase
      .from("dune_executions")
      .select("*")
      .eq("processed", false)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order("created_at", { ascending: true })
      .limit(10) // Process max 10 at a time

    if (fetchError) {
      console.error(`❌ [${executionId}] Error fetching pending executions:`, fetchError)
      throw new Error(`Failed to fetch pending executions: ${fetchError.message}`)
    }

    console.log(`📋 [${executionId}] Non-terminal executions found:`, pendingExecutions?.length || 0)

    if (!pendingExecutions || pendingExecutions.length === 0) {
      console.log(`✅ [${executionId}] No pending executions found`)
      return NextResponse.json({
        success: true,
        message: "No pending executions",
        checked: 0,
        completed: 0,
        failed: 0,
      })
    }

    console.log(`📋 [${executionId}] Found ${pendingExecutions.length} pending executions:`)
    pendingExecutions.forEach((exec) => {
      console.log(`  - ${exec.execution_id} (${exec.status}) - Query ${exec.query_id}`)
    })

    let completedCount = 0
    let failedCount = 0
    let stillRunningCount = 0

    for (const execution of pendingExecutions) {
      try {
        console.log(
          `🔍 [${executionId}] Checking execution ${execution.execution_id} (current status: ${execution.status})`,
        )

        // Check status with Dune API
        const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution.execution_id}/results`, {
          headers: {
            "X-Dune-Api-Key": duneApiKey,
          },
        })

        if (resultResponse.ok) {
          const data = await resultResponse.json()
          console.log(`📊 [${executionId}] Execution ${execution.execution_id} state: ${data.state}`)

          if (data.state === "QUERY_STATE_COMPLETED") {
            const rows = data.result.rows
            console.log(`✅ [${executionId}] Query completed! ${rows.length} rows`)

            // Process and store results based on query type
            await processAndStoreResults(execution.query_id, rows, execution.execution_id)

            // Mark as completed
            await supabase
              .from("dune_executions")
              .update({
                status: "COMPLETED",
                row_count: rows.length,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("execution_id", execution.execution_id)

            // Mark as processed
            await supabase
              .from("dune_executions")
              .update({ processed: true })
              .eq("execution_id", execution.execution_id)

            completedCount++
          } else if (data.state === "QUERY_STATE_FAILED" || data.state === "QUERY_STATE_CANCELLED") {
            console.log(`❌ [${executionId}] Query failed or cancelled: ${execution.execution_id} (${data.state})`)

            await supabase
              .from("dune_executions")
              .update({
                status: "FAILED",
                error_message:
                  data.state === "QUERY_STATE_CANCELLED" ? "Query was cancelled" : "Query execution failed",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("execution_id", execution.execution_id)

            failedCount++
          } else {
            // Still running, update timestamp and status
            console.log(`⏳ [${executionId}] Still running: ${execution.execution_id} (${data.state})`)
            await supabase
              .from("dune_executions")
              .update({
                status: data.state,
                updated_at: new Date().toISOString(),
              })
              .eq("execution_id", execution.execution_id)

            stillRunningCount++
          }
        } else {
          console.log(
            `⚠️ [${executionId}] Failed to check execution ${execution.execution_id}: ${resultResponse.status}`,
          )
          // Don't count this as failed, just skip for now
        }
      } catch (error) {
        console.error(`❌ [${executionId}] Error checking execution ${execution.execution_id}:`, error)
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `🎯 [${executionId}] Polling completed: ${completedCount} completed, ${failedCount} failed, ${stillRunningCount} still running, ${duration}ms`,
    )

    return NextResponse.json({
      success: true,
      message: `Polling completed: ${completedCount} completed, ${failedCount} failed, ${stillRunningCount} still running`,
      checked: pendingExecutions.length,
      completed: completedCount,
      failed: failedCount,
      still_running: stillRunningCount,
      duration_ms: duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`❌ [${executionId}] Polling failed:`, error)

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        duration_ms: duration,
      },
      { status: 500 },
    )
  }
}

async function processAndStoreResults(queryId: number, rows: any[], executionId: string) {
  console.log(`💾 Processing and storing results for query ${queryId}...`)

  if (queryId === 5184581) {
    // Dune main query
    await processAndStoreDuneResults(rows, executionId)
  } else if (queryId === 5184111) {
    // HyperEVM query
    await processAndStoreHyperEVMResults(rows, executionId)
  } else if (queryId === 5184711) {
    // Revenue query
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
      } else {
        console.log(`➕ Inserting new record for ${blockDay}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("dune_results").insert([recordData])
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
      } else {
        console.log(`➕ Inserting new HyperEVM record for ${day} - ${row.protocol_name}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("hyperevm_protocols").insert([recordData])
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
      } else {
        console.log(`➕ Inserting new revenue record for ${day}`)
        recordData.created_at = new Date().toISOString()
        await supabase.from("daily_revenue").insert([recordData])
      }
    } catch (error) {
      console.error("Error processing revenue row:", error, row)
    }
  }
  console.log(`✅ Finished processing revenue results`)
}

export async function POST(request: NextRequest) {
  return GET(request)
}
