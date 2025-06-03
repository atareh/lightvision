import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// The only Dune query ID we will now trigger in this cron
const HYPERLIQUID_STATS_QUERY_ID = 5184581

export async function GET(request: NextRequest) {
  const executionId = `cron_main_stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  await logCronStart(executionId, "daily_hyperliquid_stats_sync")

  try {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      await logCronError(executionId, "Unauthorized - invalid CRON_SECRET", startTime, "daily_hyperliquid_stats_sync")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`🕕 [${executionId}] Daily Hyperliquid Stats sync cron job triggered.`)
    await logCronProgress(executionId, "Cron job started - authorization verified", "daily_hyperliquid_stats_sync")

    const results = {
      hyperliquid_stats_sync: null,
      // Deprecated: hyperevm_sync: null,
      // Deprecated: revenue_sync: null,
      cmc_sync: null,
    }

    let duneQuerySuccess = false
    let cmcSyncSuccess = false

    // TRIGGER Hyperliquid Stats Dune sync (main TVL/Wallets query)
    results.hyperliquid_stats_sync = {
      success: true,
      message: "Query 5184581 (Hyperliquid Stats) is now handled by webhook. Trigger skipped.",
    }
    duneQuerySuccess = true // Mark as success as it's intentionally skipped.
    console.log(
      `[${executionId}] Hyperliquid Stats Dune sync (Query ID: ${HYPERLIQUID_STATS_QUERY_ID}) is handled by webhook. Trigger skipped.`,
    )
    await logCronProgress(
      executionId,
      `Hyperliquid Stats Dune sync (Query ID ${HYPERLIQUID_STATS_QUERY_ID}) trigger skipped, handled by webhook.`,
      "daily_hyperliquid_stats_sync",
    )

    // CMC sync can still run as it's independent
    try {
      console.log(`🪙 [${executionId}] Starting CMC sync...`)
      await logCronProgress(executionId, "Starting CMC sync", "daily_hyperliquid_stats_sync")

      const cmcResult = await performCMCSync(executionId) // Assuming performCMCSync is defined below or imported
      results.cmc_sync = cmcResult

      if (cmcResult.success) {
        cmcSyncSuccess = true
        console.log(`✅ [${executionId}] CMC sync completed successfully`)
        await logCronProgress(executionId, "CMC sync completed successfully", "daily_hyperliquid_stats_sync")
      } else {
        console.log(`❌ [${executionId}] CMC sync failed:`, cmcResult.error)
        await logCronProgress(executionId, `CMC sync failed: ${cmcResult.error}`, "daily_hyperliquid_stats_sync")
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] CMC sync failed:`, error)
      results.cmc_sync = { success: false, error: errorMsg }
      await logCronProgress(executionId, `CMC sync exception: ${errorMsg}`, "daily_hyperliquid_stats_sync")
    }

    const overallSuccess = duneQuerySuccess && cmcSyncSuccess
    const duration = Date.now() - startTime
    const successCount = (duneQuerySuccess ? 1 : 0) + (cmcSyncSuccess ? 1 : 0)
    const errorCount = 2 - successCount

    console.log(
      `🎯 [${executionId}] Daily Hyperliquid Stats sync completed: ${successCount}/2 tasks successful, ${errorCount} errors, ${duration}ms`,
    )

    await logCronComplete(
      executionId,
      overallSuccess,
      successCount,
      errorCount,
      results,
      duration,
      "daily_hyperliquid_stats_sync",
    )

    return NextResponse.json({
      success: overallSuccess,
      execution_id: executionId,
      message: overallSuccess
        ? "Daily Hyperliquid Stats sync triggers completed successfully."
        : `Daily Hyperliquid Stats sync completed with ${errorCount} task failures.`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      success_count: successCount,
      error_count: errorCount,
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`❌ [${executionId}] Cron job failed:`, error)
    await logCronError(executionId, errorMsg, startTime, duration, "daily_hyperliquid_stats_sync")

    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        message: "Cron job failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      },
      { status: 500 },
    )
  }
}

// Generic function to trigger a specific Dune query
async function triggerSpecificDuneQuery(cronJobInternalExecutionId: string, queryId: number, queryName: string) {
  console.log(
    `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Attempting to trigger Dune query ID ${queryId}`,
  )
  try {
    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      console.error(`[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): DUNE_API_KEY not found`)
      throw new Error("DUNE_API_KEY not found")
    }

    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Executing Dune query ${queryId}...`,
    )
    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    const execResponseText = await execResponse.text()
    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Dune execute response status: ${execResponse.status}, body: ${execResponseText.substring(0, 200)}`,
    )

    if (!execResponse.ok) {
      throw new Error(`Dune execute failed for ${queryName}: ${execResponse.status} - ${execResponseText}`)
    }

    let execData
    try {
      execData = JSON.parse(execResponseText)
    } catch (e) {
      throw new Error(`Dune execute response is not valid JSON for ${queryName}: ${execResponseText}`)
    }

    const duneExecutionId = execData.execution_id // Renamed to avoid confusion with cronJobInternalExecutionId
    if (!duneExecutionId) {
      throw new Error(`Dune execute response missing execution_id for ${queryName}: ${execResponseText}`)
    }
    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Dune execution_id received: ${duneExecutionId}`,
    )

    const insertPayload = {
      execution_id: duneExecutionId,
      query_id: queryId,
      status: "PENDING",
      cron_execution_id: cronJobInternalExecutionId,
    }
    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Attempting to insert into Supabase dune_executions:`,
      JSON.stringify(insertPayload),
    )

    const {
      data: insertData,
      error: insertError,
      status: insertStatus,
      statusText: insertStatusText,
    } = await supabase.from("dune_executions").insert([insertPayload]).select()

    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Supabase insert response - Status: ${insertStatus}, StatusText: ${insertStatusText}, Error: ${JSON.stringify(insertError)}, Data: ${JSON.stringify(insertData)}`,
    )

    if (insertError) {
      console.error(
        `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Supabase insert failed. Status: ${insertStatus}, Error: ${JSON.stringify(insertError)}`,
      )
      throw new Error(
        `Supabase insert failed for ${queryName} (Dune exec_id ${duneExecutionId}): ${insertError.message} (Code: ${insertError.code}, Details: ${insertError.details}, Hint: ${insertError.hint})`,
      )
    }

    console.log(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): Supabase insert successful for Dune execution_id ${duneExecutionId}`,
    )
    return {
      success: true,
      execution_id: duneExecutionId, // This is the Dune execution_id
      message: `${queryName} query triggered and Supabase record created successfully`,
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : `Unknown error in triggerSpecificDuneQuery for ${queryName}`
    console.error(
      `[${cronJobInternalExecutionId}] triggerSpecificDuneQuery (${queryName}): CATCH BLOCK - Error: ${errorMsg}`,
    )
    return {
      success: false,
      error: errorMsg,
    }
  }
}

// performCMCSync function remains the same as your previous version
async function performCMCSync(executionId: string) {
  try {
    const cmcApiKey = process.env.CMC_PRO_API_KEY
    if (!cmcApiKey) {
      throw new Error("CMC_PRO_API_KEY not found in environment variables")
    }

    const cmcResponse = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=HYPE", {
      headers: {
        "X-CMC_PRO_API_KEY": cmcApiKey,
        Accept: "application/json",
      },
    })

    const responseText = await cmcResponse.text()

    if (!cmcResponse.ok) {
      throw new Error(
        `CMC API error: ${cmcResponse.status} ${cmcResponse.statusText} - ${responseText.substring(0, 200)}`,
      )
    }

    let cmcData
    try {
      cmcData = JSON.parse(responseText)
    } catch (parseError) {
      throw new Error(`CMC API returned invalid JSON. Response: ${responseText.substring(0, 200)}`)
    }

    const hypeData = cmcData.data.HYPE
    if (!hypeData) {
      throw new Error("HYPE data not found in CMC response")
    }

    const syncData = {
      symbol: "HYPE",
      price: Number.parseFloat(hypeData.quote.USD.price),
      market_cap: Math.round(Number.parseFloat(hypeData.quote.USD.market_cap || 0)),
      percent_change_24h: Number.parseFloat(hypeData.quote.USD.percent_change_24h || 0),
      fully_diluted_market_cap: Math.round(Number.parseFloat(hypeData.quote.USD.fully_diluted_market_cap || 0)),
      volume_24h: Math.round(Number.parseFloat(hypeData.quote.USD.volume_24h || 0)),
      volume_change_24h: Number.parseFloat(hypeData.quote.USD.volume_change_24h || 0),
      synced_at: new Date().toISOString(),
    }

    const { data: insertedData, error: insertError } = await supabase.from("cmc_data").insert([syncData]).select()

    if (insertError) {
      throw new Error(`Database insert error: ${insertError.message}`)
    }

    return {
      success: true,
      data: insertedData[0],
      message: "CMC data synced successfully",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "CMC sync failed",
    }
  }
}

// Logging helper functions need to accept cronType
async function logCronStart(executionId: string, cronType: string) {
  try {
    await supabase.from("cron_logs").insert([
      {
        execution_id: executionId,
        cron_type: cronType, // Use passed cronType
        status: "RUNNING",
      },
    ])
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron start:`, error)
  }
}

async function logCronProgress(executionId: string, message: string, cronType: string) {
  try {
    const { data: existing } = await supabase
      .from("cron_logs")
      .select("results")
      .eq("execution_id", executionId) // Assuming execution_id is unique enough across types for this log
      .single()

    const currentResults = existing?.results || { progress: [] }
    currentResults.progress = currentResults.progress || []
    currentResults.progress.push({
      timestamp: new Date().toISOString(),
      message,
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
  success: boolean,
  successCount: number,
  errorCount: number,
  results: any,
  duration: number,
  cronType: string,
) {
  try {
    await supabase
      .from("cron_logs")
      .update({
        status: success ? "COMPLETED" : "PARTIAL_FAILURE",
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        success_count: successCount,
        error_count: errorCount,
        results: { ...results, summary: { successCount, errorCount, duration } },
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error(`[${cronType}] Failed to log cron completion:`, error)
  }
}

async function logCronError(
  executionId: string,
  errorMessage: string,
  startTime: number,
  duration?: number,
  cronType?: string, // Optional, but good for context
) {
  const logCtx = cronType ? `[${cronType}] ` : ""
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
    console.error(`${logCtx}Failed to log cron error:`, error)
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
