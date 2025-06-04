import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto" // Import createHmac from crypto

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const duneWebhookSecret = process.env.DUNE_WEBHOOK_SECRET

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("🔴 CRITICAL: Supabase URL or Service Key is missing for Dune webhook.")
  // Consider throwing an error or handling this more gracefully if needed at startup
}
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

// Implement verifyWebhookSignature directly
async function verifyWebhookSignature(
  body: string, // raw request body
  signature: string, // value of 'x-dune-signature' header
  secret: string, // your webhook secret
): Promise<boolean> {
  const hash = createHmac("sha256", secret).update(body).digest("hex")
  return hash === signature
}

interface DuneExecutionResult {
  execution_id: string
  query_id: number
  state: string // e.g., "QUERY_STATE_COMPLETED", "QUERY_STATE_FAILED"
  is_execution_finished: boolean
  submitted_at: string
  expires_at?: string
  execution_started_at?: string
  execution_ended_at?: string
  result?: {
    rows: any[]
    metadata: {
      column_names: string[]
      column_types: string[]
      row_count: number
      // ... other metadata
    }
  }
  error?: {
    type: string
    message: string
  }
}

// Mapping Query IDs to table names and their primary key for conflict resolution
const QUERY_TABLE_MAP: Record<number, { tableName: string; conflictKey: string; transform?: (row: any) => any }> = {
  5184581: { tableName: "hyperliquid_stats_by_day", conflictKey: "day" }, // Main Hyperliquid Stats (TVL, Wallets)
  5184595: { tableName: "hyperevm_stats_by_day", conflictKey: "day" }, // HyperEVM Stats (TVL, Transactions)
  // Add other query IDs and their corresponding tables/keys here
  // Example for revenue if it were from a different query ID:
  // 5XXXXXX: { tableName: "daily_revenue", conflictKey: "day", transform: transformRevenueData },
}

async function updateDuneExecutionStatus(executionId: string, status: string, results?: any, errorMsg?: string) {
  if (!supabase) return
  try {
    await supabase
      .from("dune_executions")
      .update({
        status: status,
        results: results || null,
        error_message: errorMsg || null,
        updated_at: new Date().toISOString(), // Ensure updated_at is set
        completed_at: new Date().toISOString(), // Mark completion time
      })
      .eq("execution_id", executionId)
  } catch (dbError) {
    console.error(`[DuneWebhook] Failed to update Dune execution status in DB for ${executionId}:`, dbError)
  }
}

// Helper function to get UTC date string
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

async function processAndStoreDuneWebhookResults(rows: any[], webhookInvocationId: string) {
  const logPrefix = `[Webhook ${webhookInvocationId}] Query ${5184581}:`
  let successCount = 0
  let errorCount = 0
  const processingErrors: string[] = []

  console.log(`${logPrefix} Starting data storage for ${rows.length} rows.`)

  for (const row of rows) {
    try {
      const blockDay = getUTCDateString(row.block_day)
      if (!blockDay) {
        console.warn(`${logPrefix} Skipping row with invalid or missing block_day:`, row)
        errorCount++
        processingErrors.push(`Invalid block_day for row: ${JSON.stringify(row)}`)
        continue
      }

      const recordData = {
        // execution_id: webhookInvocationId, // Or a specific execution_id if Dune provides it
        query_id: 5184581,
        block_day: blockDay,
        address_count: row.address_count ? Number.parseInt(String(row.address_count)) : null,
        deposit: row.deposit ? Number.parseFloat(String(row.deposit)) : null,
        withdraw: row.withdraw ? Number.parseFloat(String(row.withdraw)) : null,
        netflow: row.netflow ? Number.parseFloat(String(row.netflow)) : null,
        total_wallets: row.address_count ? Number.parseInt(String(row.address_count)) : null, // This might need re-evaluation based on Dune query logic
        tvl: row.TVL ? Number.parseFloat(String(row.TVL)) : null,
        updated_at: new Date().toISOString(),
        // 'created_at' will be set by Supabase on new row insert during upsert
      }

      const { error: upsertError } = await supabase
        .from("dune_results")
        .upsert(recordData, { onConflict: "block_day", ignoreDuplicates: false })

      if (upsertError) {
        console.error(`${logPrefix} Error upserting Dune row for ${blockDay}:`, upsertError, row)
        errorCount++
        processingErrors.push(`Upsert error for ${blockDay}: ${upsertError.message}`)
      } else {
        successCount++
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`${logPrefix} Exception processing Dune row:`, error, row)
      errorCount++
      processingErrors.push(`Exception for row ${JSON.stringify(row)}: ${errMsg}`)
    }
  }
  console.log(`${logPrefix} Finished processing Dune results. Success: ${successCount}, Errors: ${errorCount}.`)
  return { successCount, errorCount, processingErrors }
}

async function logWebhookEvent(
  status: string,
  payload?: DuneExecutionResult | any,
  error?: string,
  durationMs?: number,
) {
  try {
    await supabase.from("webhook_logs").insert({
      // Assuming a 'webhook_logs' table
      source: "dune",
      query_id: payload?.query_id || null, // Use dynamic query_id from payload
      status: status,
      payload: payload || null,
      error_message: error || null,
      duration_ms: durationMs || null,
      received_at: new Date().toISOString(),
    })
  } catch (dbError) {
    console.error("Failed to log webhook event to database:", dbError)
  }
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    console.error("[DuneWebhook] Supabase client not initialized. Cannot process webhook.")
    return NextResponse.json({ error: "Internal Server Error: DB client not ready" }, { status: 500 })
  }
  if (!duneWebhookSecret) {
    console.error("[DuneWebhook] DUNE_WEBHOOK_SECRET is not set. Cannot verify signature.")
    return NextResponse.json({ error: "Configuration error: Webhook secret missing" }, { status: 500 })
  }

  const signature = request.headers.get("x-dune-signature")
  if (!signature) {
    console.warn("[DuneWebhook] Missing x-dune-signature header.")
    await logWebhookEvent(
      "ERROR",
      { headers: Object.fromEntries(request.headers.entries()) },
      "Missing x-dune-signature header",
    )
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (e) {
    console.error("[DuneWebhook] Failed to read request body:", e)
    await logWebhookEvent(
      "ERROR",
      { headers: Object.fromEntries(request.headers.entries()) },
      "Failed to read request body",
    )
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 })
  }

  const isVerified = await verifyWebhookSignature(rawBody, signature, duneWebhookSecret)
  if (!isVerified) {
    console.warn("[DuneWebhook] Invalid Dune webhook signature.")
    await logWebhookEvent(
      "ERROR",
      { body: rawBody, headers: Object.fromEntries(request.headers.entries()) },
      "Invalid Dune webhook signature",
    )
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  let payload: DuneExecutionResult
  try {
    payload = JSON.parse(rawBody) as DuneExecutionResult
  } catch (e) {
    console.error("[DuneWebhook] Failed to parse webhook JSON payload:", e)
    await logWebhookEvent("ERROR", { body: rawBody }, "Invalid JSON payload")
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const startTime = Date.now()
  console.log(
    `[DuneWebhook] Received VERIFIED webhook for execution ID: ${payload.execution_id}, Query ID: ${payload.query_id}, State: ${payload.state}`,
  )
  await logWebhookEvent("RECEIVED", payload)

  const queryConfig = QUERY_TABLE_MAP[payload.query_id]

  if (!queryConfig) {
    console.warn(
      `[DuneWebhook] No table mapping found for Query ID: ${payload.query_id}. Execution ID: ${payload.execution_id}.`,
    )
    await updateDuneExecutionStatus(
      payload.execution_id,
      "UNMAPPED_QUERY_ID",
      payload.result,
      `No table mapping for query_id ${payload.query_id}`,
    )
    await logWebhookEvent(
      "WARNING",
      payload,
      `No table mapping for Query ID: ${payload.query_id}`,
      Date.now() - startTime,
    )
    // Still return 200 as the webhook was valid, but we can't process it further.
    return NextResponse.json(
      { message: "Webhook received, but no processing rule for this query ID." },
      { status: 200 },
    )
  }

  if (payload.state === "QUERY_STATE_COMPLETED" && payload.result) {
    const { tableName, conflictKey, transform } = queryConfig
    const rows = payload.result.rows
    const now = new Date().toISOString()

    if (rows && rows.length > 0) {
      console.log(`[DuneWebhook] Processing ${rows.length} rows for table ${tableName} (Query ID: ${payload.query_id})`)

      const recordsToUpsert = rows.map((row) => {
        const transformedRow = transform ? transform(row) : row
        // Ensure all common fields are present or defaulted
        const baseRecord = {
          ...transformedRow,
          query_id: payload.query_id,
          execution_id: payload.execution_id,
          updated_at: now,
        }
        // Add created_at only if it's not an update (Supabase handles this with DEFAULT if not provided)
        // For upsert, if the conflict target exists, it's an update. If not, it's an insert.
        // Supabase's .upsert handles created_at correctly if the column has a DEFAULT value.
        return baseRecord
      })

      const { error: upsertError, data: upsertData } = await supabase
        .from(tableName)
        .upsert(recordsToUpsert, {
          onConflict: conflictKey,
          ignoreDuplicates: false,
        })
        .select() // Added select() to get feedback on what was upserted

      if (upsertError) {
        console.error(
          `[DuneWebhook] Error upserting data to ${tableName} for execution ${payload.execution_id}:`,
          upsertError,
        )
        await updateDuneExecutionStatus(payload.execution_id, "DB_UPSERT_FAILED", payload.result, upsertError.message)
        await logWebhookEvent("ERROR", payload, `DB Upsert Failed: ${upsertError.message}`, Date.now() - startTime)
        return NextResponse.json({ error: `Failed to upsert data: ${upsertError.message}` }, { status: 500 })
      } else {
        console.log(
          `[DuneWebhook] Successfully upserted ${upsertData?.length || 0} rows to ${tableName} for execution ${payload.execution_id}.`,
        )
        await updateDuneExecutionStatus(payload.execution_id, "COMPLETED_AND_STORED", payload.result)
        await logWebhookEvent("SUCCESS", payload, `Stored ${upsertData?.length || 0} rows.`, Date.now() - startTime)
      }
    } else {
      console.log(
        `[DuneWebhook] No rows to process for execution ${payload.execution_id}. Query ID: ${payload.query_id}`,
      )
      await updateDuneExecutionStatus(payload.execution_id, "COMPLETED_NO_DATA", payload.result)
      await logWebhookEvent("SUCCESS_NO_DATA", payload, "No rows to process.", Date.now() - startTime)
    }
  } else if (payload.state === "QUERY_STATE_FAILED" || payload.error) {
    console.error(
      `[DuneWebhook] Dune query execution ${payload.execution_id} (Query ID: ${payload.query_id}) failed. Error: ${payload.error?.message || "Unknown error"}`,
    )
    await updateDuneExecutionStatus(payload.execution_id, "DUNE_EXECUTION_FAILED", undefined, payload.error?.message)
    await logWebhookEvent(
      "DUNE_FAILURE",
      payload,
      `Dune Execution Failed: ${payload.error?.message || "Unknown"}`,
      Date.now() - startTime,
    )
  } else if (payload.is_execution_finished) {
    console.log(
      `[DuneWebhook] Dune query execution ${payload.execution_id} (Query ID: ${payload.query_id}) finished with state: ${payload.state}.`,
    )
    await updateDuneExecutionStatus(payload.execution_id, payload.state, payload.result)
    await logWebhookEvent(
      "DUNE_FINISHED_OTHER_STATE",
      payload,
      `Finished with state: ${payload.state}`,
      Date.now() - startTime,
    )
  } else {
    console.log(
      `[DuneWebhook] Dune query execution ${payload.execution_id} (Query ID: ${payload.query_id}) is in state: ${payload.state}. No data storage action taken.`,
    )
    // Optionally update status to reflect ongoing Dune execution if not already PENDING
    // await updateDuneExecutionStatus(payload.execution_id, payload.state);
    await logWebhookEvent(
      "DUNE_IN_PROGRESS",
      payload,
      `State: ${payload.state}. No data storage action.`,
      Date.now() - startTime,
    )
  }

  return NextResponse.json({ message: "Webhook received and processed" }, { status: 200 })
}

// Define a simple type for Dune rows (adjust as needed based on your actual query 5184581 structure)
// You should place this in a shared types file, e.g., lib/types.ts
// For now, adding it here for completeness of this file.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DUNE_WEBHOOK_SECRET?: string
    }
  }
}
