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
  let queryResultPayload: any

  try {
    payload = await request.json()
    console.log(`[${webhookInvocationId}] Full raw payload received:`, JSON.stringify(payload, null, 2))
    queryResultPayload = payload.query_result || {}
    console.log(
      `[${webhookInvocationId}] Attempting to parse from payload.query_result - Execution ID: ${queryResultPayload.execution_id}, Query ID: ${queryResultPayload.query_id}, State: ${queryResultPayload.state}`,
    )
    console.log(`[${webhookInvocationId}] Query Name from root payload: ${payload.query_name || "N/A"}`)
  } catch (error) {
    console.error(`[${webhookInvocationId}] Failed to parse webhook JSON payload:`, error)
    return NextResponse.json({ error: "Invalid JSON payload or empty body" }, { status: 400 })
  }

  const { execution_id, query_id, state } = queryResultPayload
  const error_message_from_payload = payload.error_message || queryResultPayload.error_message

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
    const duneExecutionUpdateData: any = {
      status: state,
      updated_at: now,
    }

    if (state === "QUERY_STATE_COMPLETED") {
      duneExecutionUpdateData.completed_at = now
      duneExecutionUpdateData.processed = false
      duneExecutionUpdateData.error_message = null
      duneExecutionUpdateData.result_id = execution_id

      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}) COMPLETED. Fetching results...`,
      )

      const resultsResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/results`, {
        headers: { "X-Dune-Api-Key": duneApiKey },
      })

      if (!resultsResponse.ok) {
        const errorText = await resultsResponse.text()
        console.error(
          `[${webhookInvocationId}] Failed to fetch results for ${execution_id}: ${resultsResponse.status} - ${errorText}`,
        )
        duneExecutionUpdateData.status = "FAILED_FETCH_RESULTS"
        duneExecutionUpdateData.error_message = `Dune API Error (${resultsResponse.status}): ${errorText.substring(0, 250)}`
        duneExecutionUpdateData.processed = true
      } else {
        const resultsData = await resultsResponse.json()
        const rows = resultsData.result?.rows || []
        duneExecutionUpdateData.row_count = rows.length
        console.log(
          `[${webhookInvocationId}] Fetched ${rows.length} rows for execution ${execution_id}. Processing and storing...`,
        )

        const storeSuccess = await processAndStoreResults(query_id, rows, execution_id, webhookInvocationId)
        if (storeSuccess) {
          duneExecutionUpdateData.processed = true
          duneExecutionUpdateData.status = "COMPLETED_AND_STORED"
        } else {
          duneExecutionUpdateData.processed = true
          duneExecutionUpdateData.status = "COMPLETED_STORE_FAILED"
          duneExecutionUpdateData.error_message =
            duneExecutionUpdateData.error_message || "Failed to store all results into database."
          console.warn(`[${webhookInvocationId}] Execution ${execution_id} completed, but result storage had issues.`)
        }
      }
    } else if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      duneExecutionUpdateData.completed_at = now
      duneExecutionUpdateData.processed = true
      duneExecutionUpdateData.error_message =
        error_message_from_payload ||
        queryResultPayload.error?.message ||
        `Query ${state.replace("QUERY_STATE_", "")} on Dune.`
      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}) ${state}. Error: ${duneExecutionUpdateData.error_message}`,
      )
    } else {
      console.log(
        `[${webhookInvocationId}] Execution ${execution_id} (Query ${query_id}) is in state: ${state}. No results to fetch yet.`,
      )
    }

    const { error: upsertError } = await supabase.from("dune_executions").upsert(
      {
        execution_id: execution_id,
        query_id: query_id,
        ...duneExecutionUpdateData,
      },
      {
        onConflict: "execution_id",
        ignoreDuplicates: false,
      },
    )

    if (upsertError) {
      console.error(`[${webhookInvocationId}] Error upserting to dune_executions for ${execution_id}:`, upsertError)
    }

    console.log(`[${webhookInvocationId}] Successfully processed webhook for execution_id: ${execution_id}`)
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
      "dune_results",
      "query_id, block_day", // UPDATED conflict target
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
      console.error(`${logPrefix} Error upserting ${recordsToUpsert.length} rows to ${tableName}:`, upsertError)
      errorCount += recordsToUpsert.length - (count || 0) // Approximate error count
    } else {
      successCount = count || recordsToUpsert.length
      console.log(`${logPrefix} Successfully upserted/updated ${successCount} records in ${tableName}.`)
    }
  } else {
    console.log(`${logPrefix} No valid records to upsert to ${tableName} after transformation.`)
  }

  console.log(`${logPrefix} Processing for ${tableName} complete. Success: ${successCount}, Errors: ${errorCount}.`)
  return errorCount === 0
}

function getUTCDateString(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null
  try {
    let date: Date
    if (typeof dateInput === "string") {
      // Handle YYYY-MM-DD format by ensuring it's treated as UTC
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
    // Return YYYY-MM-DD string representation of the UTC date
    return date.toISOString().split("T")[0]
  } catch (e) {
    console.error("Error parsing date in getUTCDateString:", dateInput, e)
    return null
  }
}

function transformHyperliquidStatsRow(row: any, duneExecutionId: string, queryId: number): object | null {
  const blockDay = getUTCDateString(row.block_day) // Dune provides 'block_day' as YYYY-MM-DD HH:MM:SS
  if (!blockDay) {
    console.warn(`[TransformHyperliquidStats] Skipping row with invalid block_day: ${row.block_day}`)
    return null
  }
  return {
    execution_id: duneExecutionId, // Added
    query_id: queryId, // Added
    block_day: blockDay, // This will be YYYY-MM-DD
    address_count: row.address_count ? Number.parseInt(String(row.address_count)) : null,
    deposit: row.deposit ? Number.parseFloat(String(row.deposit)) : null,
    withdraw: row.withdraw ? Number.parseFloat(String(row.withdraw)) : null,
    netflow: row.netflow ? Number.parseFloat(String(row.netflow)) : null,
    total_wallets: row.address_count ? Number.parseInt(String(row.address_count)) : null, // Added, mapped from address_count
    tvl: row.TVL ? Number.parseFloat(String(row.TVL)) : null, // Dune payload uses 'TVL'
    updated_at: new Date().toISOString(),
    // created_at is assumed to be handled by DB default
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
    // Assuming hyperevm_stats_by_day also benefits from execution_id and query_id
    execution_id: duneExecutionId,
    query_id: queryId,
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
    // Assuming daily_revenue also benefits from execution_id and query_id
    execution_id: duneExecutionId,
    query_id: queryId,
    day: day,
    revenue: row.revenue ? Number.parseFloat(String(row.revenue)) : null,
    annualized_revenue: row.annualized_revenue ? Number.parseFloat(String(row.annualized_revenue)) : null,
    updated_at: new Date().toISOString(),
  }
}
