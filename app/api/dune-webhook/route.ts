import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { DuneExecutionResultRow } from "@/lib/types" // Assuming you have or will create this type

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DUNE_QUERY_ID = 5184581 // The specific query ID we're handling
const DUNE_API_KEY = process.env.DUNE_API_KEY

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

async function processAndStoreDuneWebhookResults(rows: DuneExecutionResultRow[], webhookInvocationId: string) {
  const logPrefix = `[Webhook ${webhookInvocationId}] Query ${DUNE_QUERY_ID}:`
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
        query_id: DUNE_QUERY_ID,
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

async function logWebhookEvent(status: string, payload?: any, error?: string, durationMs?: number) {
  try {
    await supabase.from("webhook_logs").insert({
      // Assuming a 'webhook_logs' table
      source: "dune",
      query_id: DUNE_QUERY_ID,
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
  const webhookInvocationId = `dune_webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const startTime = Date.now()

  // Optional: Basic security check (e.g., a shared secret in the header or query param)
  // const sharedSecret = request.headers.get("X-Dune-Webhook-Secret");
  // if (sharedSecret !== process.env.DUNE_WEBHOOK_SECRET) {
  //   await logWebhookEvent("REJECTED_UNAUTHORIZED", { reason: "Invalid secret" });
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  let dunePayload = {}
  try {
    dunePayload = await request.json()
    console.log(
      `[${webhookInvocationId}] Received Dune webhook. Payload:`,
      JSON.stringify(dunePayload).substring(0, 500),
    )
    // You might parse query_id or execution_id from dunePayload if available and needed
    // For now, we assume it's a signal for DUNE_QUERY_ID
  } catch (e) {
    console.error(`[${webhookInvocationId}] Error parsing webhook payload:`, e)
    await logWebhookEvent(
      "FAILED_PAYLOAD_PARSE",
      { error: (e as Error).message },
      (e as Error).message,
      Date.now() - startTime,
    )
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  if (!DUNE_API_KEY) {
    console.error(`[${webhookInvocationId}] DUNE_API_KEY not configured.`)
    await logWebhookEvent(
      "FAILED_CONFIG_MISSING",
      { error: "DUNE_API_KEY missing" },
      "DUNE_API_KEY not configured",
      Date.now() - startTime,
    )
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    console.log(`[${webhookInvocationId}] Fetching latest results for Dune query ${DUNE_QUERY_ID}...`)
    const duneResultsUrl = `https://api.dune.com/api/v1/query/${DUNE_QUERY_ID}/results?limit=1000` // As per prompt

    const response = await fetch(duneResultsUrl, {
      headers: {
        "X-Dune-Api-Key": DUNE_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[${webhookInvocationId}] Error fetching Dune results: ${response.status} - ${errorText}`)
      await logWebhookEvent(
        "FAILED_DUNE_FETCH",
        { status: response.status, error: errorText },
        `Dune API Error: ${response.status}`,
        Date.now() - startTime,
      )
      return NextResponse.json(
        { error: `Failed to fetch Dune results: ${response.status}` },
        { status: response.status },
      )
    }

    const data = await response.json()

    if (!data.result || !Array.isArray(data.result.rows)) {
      console.error(`[${webhookInvocationId}] Invalid data structure from Dune results API:`, data)
      await logWebhookEvent(
        "FAILED_DUNE_DATA_INVALID",
        { response: JSON.stringify(data).substring(0, 500) },
        "Invalid data structure from Dune",
        Date.now() - startTime,
      )
      return NextResponse.json({ error: "Invalid data structure from Dune" }, { status: 500 })
    }

    const rows: DuneExecutionResultRow[] = data.result.rows
    console.log(`[${webhookInvocationId}] Fetched ${rows.length} rows from Dune. Processing...`)

    const { successCount, errorCount, processingErrors } = await processAndStoreDuneWebhookResults(
      rows,
      webhookInvocationId,
    )

    const durationMs = Date.now() - startTime
    if (errorCount > 0) {
      await logWebhookEvent(
        "COMPLETED_WITH_ERRORS",
        { successCount, errorCount, errors: processingErrors },
        `${errorCount} rows failed to process.`,
        durationMs,
      )
      // Still return 200 to Dune if some data was processed, or decide based on severity
      return NextResponse.json(
        { message: "Webhook processed with some errors.", successCount, errorCount, errors: processingErrors },
        { status: 200 },
      )
    }

    await logWebhookEvent("COMPLETED_SUCCESS", { successCount, rowCount: rows.length }, null, durationMs)
    console.log(`[${webhookInvocationId}] Webhook processed successfully. ${successCount} rows stored.`)
    return NextResponse.json({ message: "Webhook processed successfully", successCount }, { status: 200 })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`[${webhookInvocationId}] Unexpected error processing webhook:`, error)
    await logWebhookEvent("FAILED_UNEXPECTED", { error: errMsg }, errMsg, Date.now() - startTime)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
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
