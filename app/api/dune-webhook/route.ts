import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const duneApiKey = process.env.DUNE_API_KEY
const EXPECTED_DUNE_WEBHOOK_SECRET = process.env.DUNE_WEBHOOK_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("CRITICAL: Supabase URL or Service Role Key is not defined. Webhook cannot initialize Supabase client.")
}

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!)

export async function POST(request: NextRequest) {
  const webhookInvocationId = `dune_webhook_received_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  console.log(`[${webhookInvocationId}] Dune Webhook POST request received.`)

  const incomingSecret = request.nextUrl.searchParams.get("dune_secret")

  if (!EXPECTED_DUNE_WEBHOOK_SECRET) {
    console.error(
      `[${webhookInvocationId}] CRITICAL: DUNE_WEBHOOK_SECRET is not configured on the server. Cannot authenticate webhook.`,
    )
    return NextResponse.json({ error: "Webhook secret not configured on server." }, { status: 500 })
  }

  if (!incomingSecret || incomingSecret !== EXPECTED_DUNE_WEBHOOK_SECRET) {
    console.warn(
      `[${webhookInvocationId}] Unauthorized webhook access attempt. Incoming secret via URL param did not match or was missing.`,
    )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.log(`[${webhookInvocationId}] Webhook authorized successfully via URL secret.`)

  let payload: any
  let queryResultPayload: any // To store the nested query_result object

  try {
    payload = await request.json()
    console.log(`[${webhookInvocationId}] Full raw payload received:`, JSON.stringify(payload, null, 2))

    // Extract the nested query_result object
    queryResultPayload = payload.query_result || {} // Use empty object as fallback

    console.log(
      `[${webhookInvocationId}] Attempting to parse from payload.query_result - Execution ID: ${queryResultPayload.execution_id}, Query ID: ${queryResultPayload.query_id}, State: ${queryResultPayload.state}`,
    )
    // Query name might not be in query_result, check root payload or handle if consistently missing
    console.log(`[${webhookInvocationId}] Query Name from root payload: ${payload.query_name || "N/A"}`)
  } catch (error) {
    console.error(`[${webhookInvocationId}] Failed to parse webhook JSON payload:`, error)
    return NextResponse.json({ error: "Invalid JSON payload or empty body" }, { status: 400 })
  }

  // Destructure from the queryResultPayload (and root payload for others if applicable)
  const { execution_id, query_id, state } = queryResultPayload
  // result_id is often the same as execution_id for fetching results.
  // error_message might be at root or nested depending on Dune's error reporting for alerts.
  // Let's assume error_message might be at the root for now if query_result itself indicates failure.
  const error_message = payload.error_message || queryResultPayload.error_message // Check both
  const query_name = payload.query_name // This was undefined in your example, might always be for this webhook type

  if (!execution_id || !query_id || !state) {
    console.error(
      `[${webhookInvocationId}] Missing required fields after attempting to destructure from payload.query_result. Execution ID: ${execution_id}, Query ID: ${query_id}, State: ${state}. Check raw payload log above.`,
    )
    return NextResponse.json({ error: "Missing required fields in payload.query_result" }, { status: 400 })
  }

  if (!duneApiKey) {
    console.error(`[${webhookInvocationId}] CRITICAL: DUNE_API_KEY is not configured. Cannot fetch results.`)
    return NextResponse.json({ error: "Server configuration error: DUNE_API_KEY missing." }, { status: 500 })
  }

  try {
    const now = new Date().toISOString()
    const updateData: any = {
      status: state,
      updated_at: now,
      query_name: query_name || null, // Will be null if not provided by Dune
    }

    if (state === "QUERY_STATE_COMPLETED") {
      updateData.completed_at = now
      updateData.processed = false
      updateData.error_message = null // Clear previous error if any
      // result_id for fetching results is the execution_id
      updateData.result_id = execution_id

      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}, Name: ${query_name || "N/A"}) COMPLETED. Fetching results...`,
      )

      const resultsResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/results`, {
        headers: { "X-Dune-Api-Key": duneApiKey },
      })

      if (!resultsResponse.ok) {
        const errorText = await resultsResponse.text()
        console.error(
          `[${webhookInvocationId}] Failed to fetch results for ${execution_id}: ${resultsResponse.status} - ${errorText}`,
        )
        updateData.status = "FAILED_FETCH_RESULTS"
        updateData.error_message = `Dune API Error (${resultsResponse.status}): ${errorText.substring(0, 250)}`
        updateData.processed = true
      } else {
        const resultsData = await resultsResponse.json()
        // The actual rows are at resultsData.result.rows, as seen in previous Dune API interactions
        const rows = resultsData.result?.rows || []
        updateData.row_count = rows.length
        console.log(
          `[${webhookInvocationId}] Fetched ${rows.length} rows for execution ${execution_id}. Processing and storing...`,
        )

        const storeSuccess = await processAndStoreResults(query_id, rows, execution_id, webhookInvocationId)
        if (storeSuccess) {
          updateData.processed = true
          updateData.status = "COMPLETED_AND_STORED"
        } else {
          updateData.processed = true
          updateData.status = "COMPLETED_STORE_FAILED"
          updateData.error_message = updateData.error_message || "Failed to store all results into database."
          console.warn(`[${webhookInvocationId}] Execution ${execution_id} completed, but result storage had issues.`)
        }
      }
    } else if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      updateData.completed_at = now
      updateData.processed = true
      updateData.error_message =
        error_message || queryResultPayload.error?.message || `Query ${state.replace("QUERY_STATE_", "")} on Dune.` // Try to get a more specific error from query_result if available
      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}, Name: ${query_name || "N/A"}) ${state}. Error: ${updateData.error_message}`,
      )
    } else {
      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}, Name: ${query_name || "N/A"}) is in state: ${state}. No results to fetch yet.`,
      )
    }

    const { error: upsertError } = await supabase.from("dune_executions").upsert(
      {
        execution_id: execution_id,
        query_id: query_id,
        ...updateData,
      },
      {
        onConflict: "execution_id",
        ignoreDuplicates: false,
      },
    )

    if (upsertError) {
      console.error(`[${webhookInvocationId}] Error upserting to dune_executions for ${execution_id}:`, upsertError)
    }

    console.log(`[${webhookInvocationId}] Successfully processed and logged webhook for execution_id: ${execution_id}`)
    return NextResponse.json({ success: true, message: "Webhook processed" })
  } catch (error: any) {
    console.error(`[${webhookInvocationId}] Unhandled error processing webhook for ${execution_id}:`, error)
    try {
      await supabase
        .from("dune_executions")
        .update({
          status: "WEBHOOK_PROCESSING_ERROR",
          error_message: `Unhandled webhook error: ${error.message ? error.message.substring(0, 250) : "Unknown error"}`,
          updated_at: new Date().toISOString(),
          processed: true,
        })
        .eq("execution_id", execution_id)
    } catch (dbError) {
      console.error(`[${webhookInvocationId}] Failed to log unhandled error to dune_executions table:`, dbError)
    }
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

// ... (processAndStoreResults and other helper functions remain unchanged) ...
async function processAndStoreResults(
  queryId: number,
  rows: any[],
  duneExecutionId: string,
  webhookInvocationId: string,
): Promise<boolean> {
  const logPrefix = `[${webhookInvocationId}] StoreResults (Query ${queryId}, DuneExec ${duneExecutionId}):`
  console.log(`${logPrefix} Starting data storage for ${rows.length} rows.`)
  let allSuccessful = true

  if (queryId === 5184581) {
    allSuccessful = await storeDataInTable(
      rows,
      "hyperliquid_stats_by_day",
      "block_day",
      transformHyperliquidStatsRow,
      duneExecutionId,
      queryId,
      webhookInvocationId,
    )
  } else if (queryId === 5184111) {
    allSuccessful = await storeDataInTable(
      rows,
      "hyperevm_stats_by_day",
      "day, protocol_name",
      transformHyperEVMStatsRow,
      duneExecutionId,
      queryId,
      webhookInvocationId,
    )
  } else if (queryId === 5184711) {
    allSuccessful = await storeDataInTable(
      rows,
      "daily_revenue",
      "day",
      transformRevenueRow,
      duneExecutionId,
      queryId,
      webhookInvocationId,
    )
  } else {
    console.warn(`${logPrefix} Unknown query_id ${queryId}. No processing function defined.`)
    return false
  }
  console.log(`${logPrefix} Finished data storage attempt. Overall success: ${allSuccessful}`)
  return allSuccessful
}

async function storeDataInTable(
  rows: any[],
  tableName: string,
  conflictColumns: string,
  transformFunction: (row: any, duneExecutionId: string, queryId: number) => object | null,
  duneExecutionId: string,
  queryId: number,
  webhookInvocationId: string,
): Promise<boolean> {
  const logPrefix = `[${webhookInvocationId}] StoreInTable:${tableName} (Query ${queryId}, DuneExec ${duneExecutionId}):`
  let successCount = 0
  let errorCount = 0
  const recordsToUpsert = []

  for (const row of rows) {
    try {
      const transformedRow = transformFunction(row, duneExecutionId, queryId)
      if (transformedRow) {
        recordsToUpsert.push(transformedRow)
      } else {
        console.log(`${logPrefix} Transformer skipped row:`, JSON.stringify(row).substring(0, 100))
      }
    } catch (error) {
      console.error(`${logPrefix} Exception transforming row:`, error, JSON.stringify(row).substring(0, 100))
      errorCount++
    }
  }

  if (recordsToUpsert.length > 0) {
    const { error: upsertError, count } = await supabase
      .from(tableName)
      .upsert(recordsToUpsert, { onConflict: conflictColumns, ignoreDuplicates: false })

    if (upsertError) {
      console.error(`${logPrefix} Error upserting ${recordsToUpsert.length} rows:`, upsertError)
      errorCount += recordsToUpsert.length - (count || 0)
    } else {
      successCount = count || recordsToUpsert.length
      console.log(`${logPrefix} Successfully upserted/updated ${successCount} records.`)
    }
  } else {
    console.log(`${logPrefix} No valid records to upsert after transformation.`)
  }

  console.log(`${logPrefix} Processing complete. Success: ${successCount}, Errors: ${errorCount}.`)
  return errorCount === 0 && (recordsToUpsert.length > 0 || rows.length === 0)
}

function getUTCDateString(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null
  try {
    let date: Date
    if (typeof dateInput === "string") {
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(dateInput + "T00:00:00Z")
      } else {
        date = new Date(dateInput)
      }
    } else {
      date = dateInput
    }

    if (isNaN(date.getTime())) {
      console.warn("Invalid date input for getUTCDateString:", dateInput)
      return null
    }
    return date.toISOString().split("T")[0]
  } catch (e) {
    console.error("Error parsing date in getUTCDateString:", dateInput, e)
    return null
  }
}

function transformHyperliquidStatsRow(row: any, duneExecutionId: string, queryId: number): object | null {
  const blockDay = getUTCDateString(row.block_day)
  if (!blockDay) {
    console.warn(`[TransformHyperliquidStats] Skipping row with invalid block_day: ${row.block_day}`)
    return null
  }
  return {
    block_day: blockDay,
    address_count: row.address_count ? Number.parseInt(String(row.address_count)) : null,
    deposit: row.deposit ? Number.parseFloat(String(row.deposit)) : null,
    withdraw: row.withdraw ? Number.parseFloat(String(row.withdraw)) : null,
    netflow: row.netflow ? Number.parseFloat(String(row.netflow)) : null,
    total_wallets: row.address_count ? Number.parseInt(String(row.address_count)) : null,
    tvl: row.TVL ? Number.parseFloat(String(row.TVL)) : null,
    updated_at: new Date().toISOString(),
  }
}

function transformHyperEVMStatsRow(row: any, duneExecutionId: string, queryId: number): object | null {
  const day = getUTCDateString(row.day)
  if (!day || !row.protocol_name) {
    console.warn(
      `[TransformHyperEVMStats] Skipping row with missing day or protocol_name. Day: ${row.day}, Protocol: ${row.protocol_name}`,
    )
    return null
  }
  return {
    day: day,
    protocol_name: row.protocol_name,
    daily_tvl: row.daily_tvl ? Number.parseFloat(String(row.daily_tvl)) : null,
    total_daily_tvl: row.total_daily_tvl ? Number.parseFloat(String(row.total_daily_tvl)) : null,
    updated_at: new Date().toISOString(),
  }
}

function transformRevenueRow(row: any, duneExecutionId: string, queryId: number): object | null {
  const day = getUTCDateString(row.day)
  if (!day) {
    console.warn(`[TransformRevenue] Skipping row with missing day: ${row.day}`)
    return null
  }
  return {
    day: day,
    revenue: row.revenue ? Number.parseFloat(String(row.revenue)) : null,
    annualized_revenue: row.annualized_revenue ? Number.parseFloat(String(row.annualized_revenue)) : null,
    updated_at: new Date().toISOString(),
  }
}
