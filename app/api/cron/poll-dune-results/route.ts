import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CRON_TYPE = "poll_dune_results"
const STALE_EXECUTION_THRESHOLD_HOURS = 6 // Consider an execution stale if not completed after 6 hours

async function logCronStart(executionId: string, cronType: string) {
  try {
    await supabase.from("cron_logs").insert([
      {
        execution_id: executionId,
        cron_type: cronType,
        status: "RUNNING",
        started_at: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron start:`, error)
  }
}

async function logCronProgress(executionId: string, cronType: string, message: string, details?: any) {
  try {
    const { data: existing } = await supabase
      .from("cron_logs")
      .select("results")
      .eq("execution_id", executionId)
      .single()

    const currentResults = existing?.results || { progress: [] }
    currentResults.progress = currentResults.progress || []
    currentResults.progress.push({
      timestamp: new Date().toISOString(),
      message,
      details: details || undefined,
    })

    await supabase
      .from("cron_logs")
      .update({
        results: currentResults,
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron progress:`, error)
  }
}

async function logCronComplete(
  executionId: string,
  cronType: string,
  success: boolean,
  summary: any,
  duration: number,
) {
  try {
    await supabase
      .from("cron_logs")
      .update({
        status: success ? "COMPLETED" : "PARTIAL_FAILURE",
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        results: summary, // Store overall summary here
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron completion:`, error)
  }
}

async function logCronError(
  executionId: string,
  cronType: string,
  errorMessage: string,
  startTime: number,
  duration?: number,
) {
  try {
    const finalDuration = duration || Date.now() - startTime
    await supabase
      .from("cron_logs")
      .update({
        status: "FAILED",
        completed_at: new Date().toISOString(),
        duration_ms: finalDuration,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron error:`, error)
  }
}

export async function GET(request: NextRequest) {
  const cronJobExecutionId = `${CRON_TYPE}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  await logCronStart(cronJobExecutionId, CRON_TYPE)

  try {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      await logCronError(cronJobExecutionId, CRON_TYPE, "Unauthorized - invalid CRON_SECRET", startTime)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await logCronProgress(cronJobExecutionId, CRON_TYPE, "Cron job started - authorization verified")

    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      await logCronError(cronJobExecutionId, CRON_TYPE, "DUNE_API_KEY not found", startTime)
      throw new Error("DUNE_API_KEY not found")
    }

    const staleThreshold = new Date(Date.now() - STALE_EXECUTION_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString()

    const { data: pendingExecutions, error: fetchError } = await supabase
      .from("dune_executions")
      .select("*")
      .eq("processed", false)
      .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Look at last 48 hours for unprocessed
      .order("created_at", { ascending: true })
      .limit(10)

    if (fetchError) {
      await logCronError(
        cronJobExecutionId,
        CRON_TYPE,
        `Failed to fetch pending executions: ${fetchError.message}`,
        startTime,
      )
      throw new Error(`Failed to fetch pending executions: ${fetchError.message}`)
    }

    await logCronProgress(
      cronJobExecutionId,
      CRON_TYPE,
      `Found ${pendingExecutions?.length || 0} non-processed executions to check.`,
    )

    if (!pendingExecutions || pendingExecutions.length === 0) {
      const duration = Date.now() - startTime
      await logCronComplete(
        cronJobExecutionId,
        CRON_TYPE,
        true,
        { message: "No pending executions to process." },
        duration,
      )
      return NextResponse.json({
        success: true,
        message: "No pending executions",
        checked: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
      })
    }

    let completedCount = 0
    let failedCount = 0
    let stillRunningCount = 0
    let stalledCount = 0
    const processingDetails = []

    for (const execution of pendingExecutions) {
      const executionLogPrefix = `ExecID ${execution.execution_id} (Query ${execution.query_id}):`
      try {
        // Check if execution is stale
        if (
          new Date(execution.created_at) < new Date(staleThreshold) &&
          (execution.status === "PENDING" ||
            execution.status === "QUERY_STATE_EXECUTING" ||
            execution.status === "QUERY_STATE_PENDING")
        ) {
          console.log(
            `🔶 [${cronJobExecutionId}] ${executionLogPrefix} Stalled (created at ${execution.created_at}). Marking as FAILED.`,
          )
          await supabase
            .from("dune_executions")
            .update({
              status: "FAILED",
              error_message: `Execution timed out after ${STALE_EXECUTION_THRESHOLD_HOURS} hours.`,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              processed: true, // Mark as processed to prevent re-polling
            })
            .eq("execution_id", execution.execution_id)
          stalledCount++
          processingDetails.push({
            execution_id: execution.execution_id,
            status: "STALLED_TIMEOUT",
            query_id: execution.query_id,
          })
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} Marked as STALLED due to timeout.`,
          )
          continue // Move to the next execution
        }

        await logCronProgress(
          cronJobExecutionId,
          CRON_TYPE,
          `${executionLogPrefix} Checking status (current DB status: ${execution.status}).`,
        )

        const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${execution.execution_id}/results`, {
          headers: { "X-Dune-Api-Key": duneApiKey },
        })

        if (!resultResponse.ok) {
          // If Dune API returns an error (e.g. 404 if execution ID is too old or invalid)
          const errorText = await resultResponse.text()
          console.log(
            `⚠️ [${cronJobExecutionId}] ${executionLogPrefix} Failed to fetch Dune status: ${resultResponse.status} - ${errorText.substring(0, 100)}`,
          )
          await supabase
            .from("dune_executions")
            .update({
              status: "API_ERROR", // Custom status
              error_message: `Dune API error on status check: ${resultResponse.status} - ${errorText.substring(0, 200)}`,
              updated_at: new Date().toISOString(),
              processed: true, // Mark as processed if API gives definitive error for this ID
            })
            .eq("execution_id", execution.execution_id)
          failedCount++
          processingDetails.push({
            execution_id: execution.execution_id,
            status: "API_ERROR_ON_POLL",
            query_id: execution.query_id,
            error: `Dune API ${resultResponse.status}`,
          })
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} Dune API error ${resultResponse.status} on status check. Marked as API_ERROR.`,
          )
          continue
        }

        const data = await resultResponse.json()
        await logCronProgress(cronJobExecutionId, CRON_TYPE, `${executionLogPrefix} Dune API state: ${data.state}.`)

        if (data.state === "QUERY_STATE_COMPLETED") {
          const rows = data.result.rows
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} COMPLETED with ${rows.length} rows. Processing...`,
          )

          await processAndStoreResults(execution.query_id, rows, execution.execution_id, cronJobExecutionId)

          await supabase
            .from("dune_executions")
            .update({
              status: "COMPLETED",
              row_count: rows.length,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              processed: true,
              error_message: null, // Clear any previous error
            })
            .eq("execution_id", execution.execution_id)
          completedCount++
          processingDetails.push({
            execution_id: execution.execution_id,
            status: "COMPLETED_PROCESSED",
            query_id: execution.query_id,
            rows: rows.length,
          })
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} Successfully processed and stored ${rows.length} rows.`,
          )
        } else if (data.state === "QUERY_STATE_FAILED" || data.state === "QUERY_STATE_CANCELLED") {
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} FAILED or CANCELLED on Dune's side (State: ${data.state}).`,
          )
          await supabase
            .from("dune_executions")
            .update({
              status: "FAILED",
              error_message: data.error?.message || data.state || "Query execution failed/cancelled on Dune.",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              processed: true,
            })
            .eq("execution_id", execution.execution_id)
          failedCount++
          processingDetails.push({
            execution_id: execution.execution_id,
            status: "FAILED_ON_DUNE",
            query_id: execution.query_id,
            error: data.state,
          })
          await logCronProgress(cronJobExecutionId, CRON_TYPE, `${executionLogPrefix} Marked as FAILED in DB.`)
        } else {
          // Still running (EXECUTING, PENDING)
          await logCronProgress(
            cronJobExecutionId,
            CRON_TYPE,
            `${executionLogPrefix} Still running on Dune (State: ${data.state}). Will check again later.`,
          )
          await supabase
            .from("dune_executions")
            .update({
              status: data.state, // Update status from Dune
              updated_at: new Date().toISOString(),
              // DO NOT set processed: true here
            })
            .eq("execution_id", execution.execution_id)
          stillRunningCount++
          processingDetails.push({
            execution_id: execution.execution_id,
            status: "STILL_RUNNING",
            query_id: execution.query_id,
            dune_state: data.state,
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error during single execution processing"
        console.error(`❌ [${cronJobExecutionId}] ${executionLogPrefix} Error during processing loop:`, error)
        // Log error for this specific execution but don't mark as processed unless it's a definitive failure.
        // The STALLED check or Dune's FAILED state should eventually handle it.
        // If it's a transient network error, we want to retry.
        processingDetails.push({
          execution_id: execution.execution_id,
          status: "ERROR_IN_LOOP",
          query_id: execution.query_id,
          error: errorMsg.substring(0, 100),
        })
        await logCronProgress(
          cronJobExecutionId,
          CRON_TYPE,
          `${executionLogPrefix} Encountered error in processing loop: ${errorMsg.substring(0, 100)}.`,
        )
      }
    }

    const duration = Date.now() - startTime
    const summary = {
      message: `Polling completed. Checked: ${pendingExecutions.length}, Completed: ${completedCount}, Failed (Dune/API): ${failedCount}, Stalled: ${stalledCount}, Still Running: ${stillRunningCount}`,
      checked_count: pendingExecutions.length,
      completed_count: completedCount,
      failed_on_dune_count: failedCount,
      stalled_count: stalledCount,
      still_running_count: stillRunningCount,
      duration_ms: duration,
      processing_details: processingDetails,
    }
    await logCronComplete(cronJobExecutionId, CRON_TYPE, true, summary, duration)

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error in poll-dune-results GET handler"
    console.error(`❌ [${cronJobExecutionId}] Top-level error in poll-dune-results:`, error)
    await logCronError(cronJobExecutionId, CRON_TYPE, errorMsg, startTime, duration)
    return NextResponse.json({ success: false, error: errorMsg, duration_ms: duration }, { status: 500 })
  }
}

async function processAndStoreResults(queryId: number, rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query ${queryId}, ExecID ${executionId}:`
  await logCronProgress(cronJobExecutionId, CRON_TYPE, `${logPrefix} Starting data storage for ${rows.length} rows.`)

  // Using a single large transaction for upserting might be more efficient if your Supabase plan supports it well,
  // but row-by-row gives more granular error logging if some rows are problematic.
  // For now, keeping row-by-row as it was.

  if (queryId === 5184581) {
    // Dune main query -> dune_results
    await processAndStoreDuneResults(rows, executionId, cronJobExecutionId)
  } else if (queryId === 5184111) {
    // HyperEVM query -> hyperevm_protocols
    await processAndStoreHyperEVMResults(rows, executionId, cronJobExecutionId)
  } else if (queryId === 5184711) {
    // Revenue query -> daily_revenue
    await processAndStoreRevenueResults(rows, executionId, cronJobExecutionId)
  } else {
    await logCronProgress(
      cronJobExecutionId,
      CRON_TYPE,
      `${logPrefix} Unknown query_id ${queryId}. No processing function defined.`,
    )
    console.warn(`${logPrefix} Unknown query_id ${queryId}. No processing function defined.`)
  }
  await logCronProgress(cronJobExecutionId, CRON_TYPE, `${logPrefix} Finished data storage attempt.`)
}

// Helper to format date consistently, handling potential timezone issues from Dune
function getUTCDateString(dateInput: string | Date): string | null {
  if (!dateInput) return null
  try {
    // Try to parse, assuming it might be UTC or easily convertible
    const date = new Date(dateInput)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // If it's not a valid date string like "2023-10-20 00:00:00 UTC"
      // It might be just "2023-10-20". Append "T00:00:00Z" to treat it as UTC midnight.
      const isoAttempt = new Date(dateInput + "T00:00:00Z")
      if (isNaN(isoAttempt.getTime())) return null // Still invalid
      return isoAttempt.toISOString().split("T")[0]
    }
    return date.toISOString().split("T")[0]
  } catch (e) {
    console.error("Error parsing date:", dateInput, e)
    return null
  }
}

async function processAndStoreDuneResults(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184581 (Dune Main), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0

  for (const row of rows) {
    try {
      const blockDay = getUTCDateString(row.block_day)
      if (!blockDay) {
        console.warn(`${logPrefix} Skipping row with invalid or missing block_day:`, row)
        errorCount++
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
        total_wallets: row.address_count ? Number.parseInt(row.address_count) : null, // This seems redundant if address_count is daily new
        tvl: row.TVL ? Number.parseFloat(row.TVL) : null,
        updated_at: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from("dune_results")
        .upsert(recordData, { onConflict: "block_day", ignoreDuplicates: false }) // Upsert on block_day

      if (upsertError) {
        console.error(`${logPrefix} Error upserting Dune row for ${blockDay}:`, upsertError, row)
        errorCount++
      } else {
        successCount++
      }
    } catch (error) {
      console.error(`${logPrefix} Exception processing Dune row:`, error, row)
      errorCount++
    }
  }
  await logCronProgress(
    cronJobExecutionId,
    CRON_TYPE,
    `${logPrefix} Finished processing Dune results. Success: ${successCount}, Errors: ${errorCount}.`,
  )
}

async function processAndStoreHyperEVMResults(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184111 (HyperEVM), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0

  for (const row of rows) {
    try {
      const day = getUTCDateString(row.day)
      if (!day || !row.protocol_name) {
        console.warn(`${logPrefix} Skipping HyperEVM row with missing day or protocol_name:`, row)
        errorCount++
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

      const { error: upsertError } = await supabase
        .from("hyperevm_protocols")
        .upsert(recordData, { onConflict: "day, protocol_name", ignoreDuplicates: false }) // Upsert on composite key

      if (upsertError) {
        console.error(`${logPrefix} Error upserting HyperEVM row for ${day}-${row.protocol_name}:`, upsertError, row)
        errorCount++
      } else {
        successCount++
      }
    } catch (error) {
      console.error(`${logPrefix} Exception processing HyperEVM row:`, error, row)
      errorCount++
    }
  }
  await logCronProgress(
    cronJobExecutionId,
    CRON_TYPE,
    `${logPrefix} Finished processing HyperEVM results. Success: ${successCount}, Errors: ${errorCount}.`,
  )
}

async function processAndStoreRevenueResults(rows: any[], executionId: string, cronJobExecutionId: string) {
  const logPrefix = `[${cronJobExecutionId}] Query 5184711 (Revenue), ExecID ${executionId}:`
  let successCount = 0
  let errorCount = 0

  for (const row of rows) {
    try {
      const day = getUTCDateString(row.day)
      if (!day) {
        console.warn(`${logPrefix} Skipping revenue row with missing day:`, row)
        errorCount++
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

      const { error: upsertError } = await supabase
        .from("daily_revenue")
        .upsert(recordData, { onConflict: "day", ignoreDuplicates: false }) // Upsert on day

      if (upsertError) {
        console.error(`${logPrefix} Error upserting revenue row for ${day}:`, upsertError, row)
        errorCount++
      } else {
        successCount++
      }
    } catch (error) {
      console.error(`${logPrefix} Exception processing revenue row:`, error, row)
      errorCount++
    }
  }
  await logCronProgress(
    cronJobExecutionId,
    CRON_TYPE,
    `${logPrefix} Finished processing revenue results. Success: ${successCount}, Errors: ${errorCount}.`,
  )
}

// Allow POST requests as well, as Vercel cron jobs might use GET or POST
export async function POST(request: NextRequest) {
  return GET(request)
}
