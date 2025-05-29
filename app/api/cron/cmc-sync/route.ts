import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  return handleCMCCron(request, true) // true = require auth for GET (real cron)
}

export async function POST(request: NextRequest) {
  return handleCMCCron(request, false) // false = skip auth for POST (manual testing)
}

async function handleCMCCron(request: NextRequest, requireAuth: boolean) {
  const executionId = `cmc_cron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  // Start logging
  await logCronStart(executionId)

  try {
    // Only verify authorization for GET requests (real cron jobs)
    if (requireAuth) {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        await logCronError(executionId, "Unauthorized - invalid CRON_SECRET", startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      console.log(`🪙 [${executionId}] CMC sync cron job triggered (10-minute interval)`)
      await logCronProgress(executionId, "CMC cron job started - authorization verified")
    } else {
      console.log(`🪙 [${executionId}] CMC sync manual test triggered`)
      await logCronProgress(executionId, "CMC manual test started - skipping authorization")
    }

    let success = false
    let errorMessage = ""
    let cmcResult: any = null

    // Call CMC sync endpoint directly instead of making HTTP request
    try {
      console.log(`💰 [${executionId}] Starting direct CMC sync...`)
      await logCronProgress(executionId, "Starting direct CMC sync")

      // Call the CMC sync logic directly instead of making an HTTP request
      const syncResult = await performCMCSync(executionId)

      if (syncResult.success) {
        success = true
        cmcResult = syncResult.data
        console.log(`✅ [${executionId}] CMC sync completed successfully - Price: $${syncResult.data?.price}`)
        await logCronProgress(executionId, `CMC sync completed successfully - Price: $${syncResult.data?.price}`)
      } else {
        errorMessage = syncResult.error || "CMC sync failed"
        console.log(`❌ [${executionId}] CMC sync failed:`, errorMessage)
        await logCronProgress(executionId, `CMC sync failed: ${errorMessage}`)
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ [${executionId}] CMC sync failed:`, error)
      await logCronProgress(executionId, `CMC sync exception: ${errorMessage}`)
    }

    const duration = Date.now() - startTime

    console.log(`🎯 [${executionId}] CMC cron completed: ${success ? "SUCCESS" : "FAILED"}, ${duration}ms`)

    // Log completion
    await logCronComplete(
      executionId,
      success,
      success ? 1 : 0,
      success ? 0 : 1,
      { cmc_sync: cmcResult, error: errorMessage || undefined },
      duration,
      errorMessage,
    )

    return NextResponse.json({
      success,
      execution_id: executionId,
      message: success ? "CMC sync completed successfully" : `CMC sync failed: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      success_count: success ? 1 : 0,
      error_count: success ? 0 : 1,
      data: cmcResult,
      test_mode: !requireAuth,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`❌ [${executionId}] CMC cron job failed:`, error)
    await logCronError(executionId, errorMsg, startTime, duration)

    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        message: "CMC cron job failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        test_mode: !requireAuth,
      },
      { status: 500 },
    )
  }
}

// Direct CMC sync function (extracted from /api/cmc-sync)
async function performCMCSync(executionId: string) {
  try {
    console.log(`🪙 [${executionId}] Starting CMC data sync...`)

    const cmcApiKey = process.env.CMC_PRO_API_KEY
    if (!cmcApiKey) {
      throw new Error("CMC_PRO_API_KEY not found in environment variables")
    }

    // Fetch data from CoinMarketCap API
    console.log(`📡 [${executionId}] Fetching from CMC API...`)
    const cmcResponse = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=HYPE", {
      headers: {
        "X-CMC_PRO_API_KEY": cmcApiKey,
        Accept: "application/json",
      },
    })

    console.log(`📡 [${executionId}] CMC API Response Status: ${cmcResponse.status}`)
    console.log(`📡 [${executionId}] CMC API Response Headers:`, Object.fromEntries(cmcResponse.headers.entries()))

    // Get the response text once and reuse it
    const responseText = await cmcResponse.text()
    console.log(`📡 [${executionId}] CMC API Response (first 200 chars):`, responseText.substring(0, 200))

    if (!cmcResponse.ok) {
      console.error(`❌ [${executionId}] CMC API Error Response:`, responseText.substring(0, 500))
      throw new Error(
        `CMC API error: ${cmcResponse.status} ${cmcResponse.statusText} - ${responseText.substring(0, 200)}`,
      )
    }

    let cmcData
    try {
      cmcData = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`❌ [${executionId}] Failed to parse CMC response as JSON:`, parseError)
      console.error(`❌ [${executionId}] Raw response:`, responseText.substring(0, 1000))
      throw new Error(`CMC API returned invalid JSON. Response: ${responseText.substring(0, 200)}`)
    }

    const hypeData = cmcData.data.HYPE

    if (!hypeData) {
      throw new Error("HYPE data not found in CMC response")
    }

    // Extract and properly format the data
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

    console.log(`📊 [${executionId}] Formatted sync data:`, {
      price: syncData.price,
      market_cap: syncData.market_cap,
      volume_24h: syncData.volume_24h,
    })

    // Insert new record into database
    const { data: insertedData, error: insertError } = await supabase.from("cmc_data").insert([syncData]).select()

    if (insertError) {
      throw new Error(`Database insert error: ${insertError.message}`)
    }

    console.log(`✅ [${executionId}] CMC data synced successfully`)

    return {
      success: true,
      data: insertedData[0],
      message: "CMC data synced successfully",
    }
  } catch (error) {
    console.error(`❌ [${executionId}] CMC sync failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "CMC sync failed",
    }
  }
}

// Helper functions for logging
async function logCronStart(executionId: string) {
  try {
    await supabase.from("cron_logs").insert([
      {
        execution_id: executionId,
        cron_type: "cmc_sync",
        status: "RUNNING",
        started_at: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error("Failed to log CMC cron start:", error)
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
    console.error("Failed to log CMC cron progress:", error)
  }
}

async function logCronComplete(
  executionId: string,
  success: boolean,
  successCount: number,
  errorCount: number,
  results: any,
  duration: number,
  errorMessage?: string,
) {
  try {
    await supabase
      .from("cron_logs")
      .update({
        status: success ? "COMPLETED" : "FAILED",
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        success_count: successCount,
        error_count: errorCount,
        results: { ...results, summary: { successCount, errorCount, duration } },
        error_message: errorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq("execution_id", executionId)
  } catch (error) {
    console.error("Failed to log CMC cron completion:", error)
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
    console.error("Failed to log CMC cron error:", error)
  }
}
