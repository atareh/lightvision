import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const DUNE_WEBHOOK_SECRET = process.env.DUNE_WEBHOOK_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase URL or Service Role Key is not defined.")
}
const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!)

export async function POST(request: NextRequest) {
  const executionId = `dune_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  console.log(`[${executionId}] Dune Webhook received.`)

  // 1. Verify webhook secret
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== DUNE_WEBHOOK_SECRET) {
    console.warn(`[${executionId}] Unauthorized webhook access attempt.`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: any
  try {
    payload = await request.json()
    console.log(
      `[${executionId}] Webhook payload received for execution_id: ${payload.execution_id}, query_id: ${payload.query_id}, state: ${payload.state}`,
    )
  } catch (error) {
    console.error(`[${executionId}] Failed to parse webhook payload:`, error)
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const { execution_id, query_id, state, result_id, error_message, query_name } = payload

  if (!execution_id || !query_id || !state) {
    console.error(`[${executionId}] Missing required fields in webhook payload.`)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    const now = new Date().toISOString()
    const updateData: any = {
      status: state,
      updated_at: now, // Always update updated_at
    }

    if (state === "QUERY_STATE_COMPLETED") {
      updateData.completed_at = now
      updateData.processed = true // Mark as processed
      updateData.error_message = null // Clear any previous error
      updateData.result_id = result_id // Store result_id if available
      console.log(`[${executionId}] Execution ${execution_id} (Query ${query_id}) COMPLETED. Fetching results...`)

      // Fetch results from Dune API
      const resultsResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/results`, {
        headers: { "X-Dune-Api-Key": process.env.DUNE_API_KEY! },
      })

      if (!resultsResponse.ok) {
        const errorText = await resultsResponse.text()
        console.error(
          `[${executionId}] Failed to fetch results for ${execution_id}: ${resultsResponse.status} - ${errorText}`,
        )
        updateData.status = "FAILED_FETCH_RESULTS"
        updateData.error_message = `Failed to fetch results: ${resultsResponse.status} - ${errorText.substring(0, 200)}`
        updateData.processed = true // Mark as processed to avoid re-processing
      } else {
        const resultsData = await resultsResponse.json()
        const rows = resultsData.result?.rows || []
        updateData.row_count = rows.length
        console.log(`[${executionId}] Fetched ${rows.length} rows for execution ${execution_id}.`)

        // Process and store results based on query_id
        await processAndStoreResults(query_id, rows, execution_id, executionId)
      }
    } else if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      updateData.completed_at = now
      updateData.processed = true // Mark as processed
      updateData.error_message = error_message || `Query ${state.replace("QUERY_STATE_", "")} on Dune.`
      console.log(`[${executionId}] Execution ${execution_id} (Query ${query_id}) FAILED/CANCELLED.`)
    } else {
      // For PENDING, EXECUTING, etc., just update status and updated_at
      console.log(`[${executionId}] Execution ${execution_id} (Query ${query_id}) is in state: ${state}.`)
    }

    // Update the dune_executions table
    const { error: updateError } = await supabase
      .from("dune_executions")
      .update(updateData)
      .eq("execution_id", execution_id)

    if (updateError) {
      console.error(`[${executionId}] Error updating dune_executions for ${execution_id}:`, updateError)
      return NextResponse.json({ error: "Database update failed" }, { status: 500 })
    }

    console.log(`[${executionId}] Successfully processed webhook for execution_id: ${execution_id}`)
    return NextResponse.json({ success: true, message: "Webhook processed successfully" })
  } catch (error: any) {
    console.error(`[${executionId}] Unhandled error processing webhook for ${execution_id}:`, error)
    // Attempt to log the error in dune_executions if possible
    try {
      await supabase
        .from("dune_executions")
        .update({
          status: "WEBHOOK_ERROR",
          error_message: `Unhandled webhook error: ${error.message}`,
          updated_at: new Date().toISOString(),
          processed: true,
        })
        .eq("execution_id", execution_id)
    } catch (dbError) {
      console.error(`[${executionId}] Failed to log unhandled error to DB:`, dbError)
    }
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

async function processAndStoreResults(queryId: number, rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query ${queryId}, ExecID ${executionId}:`
  console.log(`${logPrefix} Starting data storage for ${rows.length} rows.`)

  if (queryId === 5184581) {
    // Dune main query -> dune_results (now hyperliquid_stats_by_day)
    await processAndStoreHyperliquidStats(rows, executionId, cronJobExecutionId)
  } else if (queryId === 5184111) {
    // HyperEVM query -> hyperevm_protocols (now hyperevm_stats_by_day)
    await processAndStoreHyperEVMStats(rows, executionId, cronJobExecutionId)
  } else if (queryId === 5184711) {
    // Revenue query -> daily_revenue
    await processAndStoreRevenueResults(rows, executionId, cronJobExecutionId)
  } else {
    console.warn(`${logPrefix} Unknown query_id ${queryId}. No processing function defined.`)
  }
  console.log(`${logPrefix} Finished data storage attempt.`)
}

// Helper to format date consistently, handling potential timezone issues from Dune
function getUTCDateString(dateInput: string | Date): string | null {
  if (!dateInput) return null
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) {
      const isoAttempt = new Date(dateInput + "T00:00:00Z")
      if (isNaN(isoAttempt.getTime())) return null
      return isoAttempt.toISOString().split("T")[0]
    }
    return date.toISOString().split("T")[0]
  } catch (e) {
    console.error("Error parsing date:", dateInput, e)
    return null
  }
}

async function processAndStoreHyperliquidStats(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184581 (Hyperliquid Stats), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0
  const recordsToUpsert = []

  for (const row of rows) {
    try {
      const blockDay = getUTCDateString(row.block_day)
      if (!blockDay) {
        console.warn(`${logPrefix} Skipping row with invalid or missing block_day:`, row)
        errorCount++
        continue
      }

      recordsToUpsert.push({
        execution_id: executionId,
        query_id: 5184581,
        block_day: blockDay,
        address_count: row.address_count ? Number.parseInt(row.address_count) : null,
        deposit: row.deposit ? Number.parseFloat(row.deposit) : null,
        withdraw: row.withdraw ? Number.parseFloat(row.withdraw) : null,
        netflow: row.netflow ? Number.parseFloat(row.netflow) : null,
        total_wallets: row.address_count ? Number.parseInt(row.address_count) : null,
        tvl: row.TVL ? Number.parseFloat(row.TVL) : null,
        updated_at: new Date().toISOString(), // Ensure updated_at is set
      })
    } catch (error) {
      console.error(`${logPrefix} Exception processing Hyperliquid Stats row:`, error, row)
      errorCount++
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error: upsertError, count } = await supabase
      .from("hyperliquid_stats_by_day") // Assuming this is the target table
      .upsert(recordsToUpsert, { onConflict: "block_day", ignoreDuplicates: false })

    if (upsertError) {
      console.error(`${logPrefix} Error upserting Hyperliquid Stats rows:`, upsertError)
      errorCount += recordsToUpsert.length // Count all as errors if batch upsert fails
    } else {
      successCount += count || recordsToUpsert.length
      console.log(`${logPrefix} Successfully upserted ${successCount} Hyperliquid Stats records.`)
    }
  } else {
    console.log(`${logPrefix} No valid Hyperliquid Stats records to upsert.`)
  }

  console.log(
    `${logPrefix} Finished processing Hyperliquid Stats results. Success: ${successCount}, Errors: ${errorCount}.`,
  )
}

async function processAndStoreHyperEVMStats(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184111 (HyperEVM Stats), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0
  const recordsToUpsert = []

  for (const row of rows) {
    try {
      const day = getUTCDateString(row.day)
      if (!day || !row.protocol_name) {
        console.warn(`${logPrefix} Skipping HyperEVM row with missing day or protocol_name:`, row)
        errorCount++
        continue
      }

      recordsToUpsert.push({
        execution_id: executionId,
        query_id: 5184111,
        day: day,
        protocol_name: row.protocol_name,
        daily_tvl: row.daily_tvl ? Number.parseFloat(row.daily_tvl) : null,
        total_daily_tvl: row.total_daily_tvl ? Number.parseFloat(row.total_daily_tvl) : null,
        updated_at: new Date().toISOString(), // Ensure updated_at is set
      })
    } catch (error) {
      console.error(`${logPrefix} Exception processing HyperEVM row:`, error, row)
      errorCount++
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error: upsertError, count } = await supabase
      .from("hyperevm_stats_by_day") // Assuming this is the target table
      .upsert(recordsToUpsert, { onConflict: "day, protocol_name", ignoreDuplicates: false })

    if (upsertError) {
      console.error(`${logPrefix} Error upserting HyperEVM Stats rows:`, upsertError)
      errorCount += recordsToUpsert.length
    } else {
      successCount += count || recordsToUpsert.length
      console.log(`${logPrefix} Successfully upserted ${successCount} HyperEVM Stats records.`)
    }
  } else {
    console.log(`${logPrefix} No valid HyperEVM Stats records to upsert.`)
  }

  console.log(
    `${logPrefix} Finished processing HyperEVM Stats results. Success: ${successCount}, Errors: ${errorCount}.`,
  )
}

async function processAndStoreRevenueResults(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184711 (Revenue), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0
  const recordsToUpsert = []

  for (const row of rows) {
    try {
      const day = getUTCDateString(row.day)
      if (!day) {
        console.warn(`${logPrefix} Skipping revenue row with missing day:`, row)
        errorCount++
        continue
      }

      recordsToUpsert.push({
        execution_id: executionId,
        query_id: 5184711,
        day: day,
        revenue: row.revenue ? Number.parseFloat(row.revenue) : null,
        annualized_revenue: row.annualized_revenue ? Number.parseFloat(row.annualized_revenue) : null,
        updated_at: new Date().toISOString(), // Ensure updated_at is set
      })
    } catch (error) {
      console.error(`${logPrefix} Exception processing revenue row:`, error, row)
      errorCount++
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error: upsertError, count } = await supabase
      .from("daily_revenue")
      .upsert(recordsToUpsert, { onConflict: "day", ignoreDuplicates: false })

    if (upsertError) {
      console.error(`${logPrefix} Error upserting revenue rows:`, upsertError)
      errorCount += recordsToUpsert.length
    } else {
      successCount += count || recordsToUpsert.length
      console.log(`${logPrefix} Successfully upserted ${successCount} revenue records.`)
    }
  } else {
    console.log(`${logPrefix} No valid revenue records to upsert.`)
  }

  console.log(`${logPrefix} Finished processing revenue results. Success: ${successCount}, Errors: ${errorCount}.`)
}
