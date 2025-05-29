import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const executionId = `cron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  // Start logging
  await logCronStart(executionId)

  try {
    // Verify this is actually a cron request from Vercel
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      await logCronError(executionId, "Unauthorized - invalid CRON_SECRET", startTime)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`🕕 [${executionId}] Daily sync cron job triggered at 6am/6pm ET`)
    await logCronProgress(executionId, "Cron job started - authorization verified")

    const results = {
      dune_sync: null,
      hyperevm_sync: null,
      revenue_sync: null,
      cmc_sync: null,
    }

    let successCount = 0
    let errorCount = 0

    // TRIGGER Dune sync (don't wait for completion)
    try {
      console.log(`📊 [${executionId}] Triggering Dune sync...`)
      await logCronProgress(executionId, "Triggering Dune sync")

      const duneResult = await triggerDuneSync(executionId)
      results.dune_sync = duneResult

      if (duneResult.success) {
        successCount++
        console.log(`✅ [${executionId}] Dune sync triggered successfully`)
        await logCronProgress(executionId, `Dune sync triggered: ${duneResult.execution_id}`)
      } else {
        errorCount++
        console.log(`❌ [${executionId}] Dune sync trigger failed:`, duneResult.error)
        await logCronProgress(executionId, `Dune sync trigger failed: ${duneResult.error}`)
      }
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] Dune sync trigger failed:`, error)
      results.dune_sync = { success: false, error: errorMsg }
      await logCronProgress(executionId, `Dune sync trigger exception: ${errorMsg}`)
    }

    // TRIGGER HyperEVM sync (don't wait for completion)
    try {
      console.log(`🔗 [${executionId}] Triggering HyperEVM sync...`)
      await logCronProgress(executionId, "Triggering HyperEVM sync")

      const hyperevmResult = await triggerHyperEVMSync(executionId)
      results.hyperevm_sync = hyperevmResult

      if (hyperevmResult.success) {
        successCount++
        console.log(`✅ [${executionId}] HyperEVM sync triggered successfully`)
        await logCronProgress(executionId, `HyperEVM sync triggered: ${hyperevmResult.execution_id}`)
      } else {
        errorCount++
        console.log(`❌ [${executionId}] HyperEVM sync trigger failed:`, hyperevmResult.error)
        await logCronProgress(executionId, `HyperEVM sync trigger failed: ${hyperevmResult.error}`)
      }
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] HyperEVM sync trigger failed:`, error)
      results.hyperevm_sync = { success: false, error: errorMsg }
      await logCronProgress(executionId, `HyperEVM sync trigger exception: ${errorMsg}`)
    }

    // TRIGGER Revenue sync (don't wait for completion)
    try {
      console.log(`💰 [${executionId}] Triggering Revenue sync...`)
      await logCronProgress(executionId, "Triggering Revenue sync")

      const revenueResult = await triggerRevenueSync(executionId)
      results.revenue_sync = revenueResult

      if (revenueResult.success) {
        successCount++
        console.log(`✅ [${executionId}] Revenue sync triggered successfully`)
        await logCronProgress(executionId, `Revenue sync triggered: ${revenueResult.execution_id}`)
      } else {
        errorCount++
        console.log(`❌ [${executionId}] Revenue sync trigger failed:`, revenueResult.error)
        await logCronProgress(executionId, `Revenue sync trigger failed: ${revenueResult.error}`)
      }
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] Revenue sync trigger failed:`, error)
      results.revenue_sync = { success: false, error: errorMsg }
      await logCronProgress(executionId, `Revenue sync trigger exception: ${errorMsg}`)
    }

    // CMC sync can complete quickly, so we can still do it synchronously
    try {
      console.log(`🪙 [${executionId}] Starting CMC sync...`)
      await logCronProgress(executionId, "Starting CMC sync")

      const cmcResult = await performCMCSync(executionId)
      results.cmc_sync = cmcResult

      if (cmcResult.success) {
        successCount++
        console.log(`✅ [${executionId}] CMC sync completed successfully`)
        await logCronProgress(executionId, "CMC sync completed successfully")
      } else {
        errorCount++
        console.log(`❌ [${executionId}] CMC sync failed:`, cmcResult.error)
        await logCronProgress(executionId, `CMC sync failed: ${cmcResult.error}`)
      }
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] CMC sync failed:`, error)
      results.cmc_sync = { success: false, error: errorMsg }
      await logCronProgress(executionId, `CMC sync exception: ${errorMsg}`)
    }

    const allTriggered = successCount >= 3 // 3 Dune queries + CMC
    const duration = Date.now() - startTime

    console.log(
      `🎯 [${executionId}] Daily sync triggers completed: ${successCount}/4 successful, ${errorCount} errors, ${duration}ms`,
    )

    // Log completion
    await logCronComplete(executionId, allTriggered, successCount, errorCount, results, duration)

    return NextResponse.json({
      success: allTriggered,
      execution_id: executionId,
      message: allTriggered
        ? "Daily sync triggers completed successfully - queries running in background"
        : `Daily sync completed with ${errorCount} trigger failures`,
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
    await logCronError(executionId, errorMsg, startTime, duration)

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

// Trigger functions that just start queries and return immediately
async function triggerDuneSync(cronExecutionId: string) {
  try {
    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184581

    if (!duneApiKey) {
      throw new Error("DUNE_API_KEY not found")
    }

    // Execute the Dune query
    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    if (!execResponse.ok) {
      const errorText = await execResponse.text()
      throw new Error(`Dune execute failed: ${execResponse.status} - ${errorText}`)
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    // Store the execution for background polling
    await supabase.from("dune_executions").insert([
      {
        execution_id: executionId,
        query_id: queryId,
        status: "PENDING",
        cron_execution_id: cronExecutionId,
        created_at: new Date().toISOString(),
      },
    ])

    return {
      success: true,
      execution_id: executionId,
      message: "Dune query triggered successfully",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function triggerHyperEVMSync(cronExecutionId: string) {
  try {
    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184111

    if (!duneApiKey) {
      throw new Error("DUNE_API_KEY not found")
    }

    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    if (!execResponse.ok) {
      const errorText = await execResponse.text()
      throw new Error(`HyperEVM execute failed: ${execResponse.status} - ${errorText}`)
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    // Store the execution for background polling
    await supabase.from("dune_executions").insert([
      {
        execution_id: executionId,
        query_id: queryId,
        status: "PENDING",
        cron_execution_id: cronExecutionId,
        created_at: new Date().toISOString(),
      },
    ])

    return {
      success: true,
      execution_id: executionId,
      message: "HyperEVM query triggered successfully",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function triggerRevenueSync(cronExecutionId: string) {
  try {
    const duneApiKey = process.env.DUNE_API_KEY
    const queryId = 5184711

    if (!duneApiKey) {
      throw new Error("DUNE_API_KEY not found")
    }

    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    if (!execResponse.ok) {
      const errorText = await execResponse.text()
      throw new Error(`Revenue execute failed: ${execResponse.status} - ${errorText}`)
    }

    const execData = await execResponse.json()
    const executionId = execData.execution_id

    // Store the execution for background polling
    await supabase.from("dune_executions").insert([
      {
        execution_id: executionId,
        query_id: queryId,
        status: "PENDING",
        cron_execution_id: cronExecutionId,
        created_at: new Date().toISOString(),
      },
    ])

    return {
      success: true,
      execution_id: executionId,
      message: "Revenue query triggered successfully",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// CMC sync function (from the working CMC cron)
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

// Helper functions for logging (same as before)
async function logCronStart(executionId: string) {
  try {
    await supabase.from("cron_logs").insert([
      {
        execution_id: executionId,
        cron_type: "daily_sync",
        status: "RUNNING",
        started_at: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error("Failed to log cron start:", error)
  }
}

async function logCronProgress(executionId: string, message: string) {
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
    })

    await supabase
      .from("cron_logs")
      .update({
        results: currentResults,
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error("Failed to log cron progress:", error)
  }
}

async function logCronComplete(
  executionId: string,
  success: boolean,
  successCount: number,
  errorCount: number,
  results: any,
  duration: number,
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
    console.error("Failed to log cron completion:", error)
  }
}

async function logCronError(executionId: string, errorMessage: string, startTime: number, duration?: number) {
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
    console.error("Failed to log cron error:", error)
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
