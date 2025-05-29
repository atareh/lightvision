import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  return handleTokenPriceRefresh(request, true) // true = require auth for GET (real cron)
}

export async function POST(request: NextRequest) {
  return handleTokenPriceRefresh(request, true) // true = require auth for POST too
}

async function handleTokenPriceRefresh(request: NextRequest, requireAuth: boolean) {
  const executionId = `price_refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  const isManualTest = request.headers.get("x-debug-password") === process.env.DEBUG_PASSWORD

  // Enhanced logging - add timestamp and execution type
  console.log(`
💰 ========== PRICE REFRESH STARTED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
🔧 Type: ${isManualTest ? "Manual Test" : "Scheduled Cron"}
⚡ Mode: PRICE ONLY (no social data)
==============================================
  `)

  try {
    // SECURITY: Always verify authorization
    if (requireAuth) {
      const authHeader = request.headers.get("authorization")
      const debugPassword = request.headers.get("x-debug-password")

      // Allow either CRON_SECRET (for real cron) or DEBUG_PASSWORD (for manual testing)
      const isValidCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
      const isValidDebug = debugPassword === process.env.DEBUG_PASSWORD

      if (!isValidCron && !isValidDebug) {
        console.error(`❌ [${executionId}] UNAUTHORIZED ACCESS ATTEMPT - Missing or invalid credentials`)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      if (isValidCron) {
        console.log(`💰 [${executionId}] Price refresh cron job triggered (1-minute interval)`)
      } else {
        console.log(`💰 [${executionId}] Price refresh manual test triggered (authenticated)`)
      }
    }

    // Get all enabled tokens from database
    console.log(`📋 [${executionId}] Fetching enabled tokens from database...`)
    const dbFetchStart = Date.now()

    const { data: tokens, error: fetchError } = await supabase
      .from("tokens")
      .select("contract_address")
      .eq("enabled", true)

    const dbFetchDuration = Date.now() - dbFetchStart

    if (fetchError) {
      console.error(`❌ [${executionId}] DATABASE ERROR: Failed to fetch tokens: ${fetchError.message}`)
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`)
    }

    console.log(`✅ [${executionId}] Database fetch completed in ${dbFetchDuration}ms`)

    if (!tokens || tokens.length === 0) {
      console.log(`⚠️ [${executionId}] No enabled tokens found`)
      return NextResponse.json({
        success: true,
        message: "No enabled tokens to refresh",
        execution_id: executionId,
        tokens_processed: 0,
      })
    }

    console.log(`📋 [${executionId}] Found ${tokens.length} enabled tokens to refresh`)

    // Use larger batches since we're only doing price updates (back to original size)
    const contractAddresses = tokens.map((t) => t.contract_address)
    const batches = chunkArray(contractAddresses, 30) // Increased from 15 to 30 for price-only

    console.log(`📦 [${executionId}] Processing ${batches.length} batches (price data only)`)

    let totalProcessed = 0
    let totalErrors = 0
    let supabaseOperations = 0
    let dexscreenerCalls = 0
    const results = []
    const errorDetails = []

    // Process batches with faster cadence since we're only doing metrics
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchStartTime = Date.now()

      // Safety check - abort if we're approaching timeout (85s limit)
      if (Date.now() - startTime > 85000) {
        console.log(`⏰ [${executionId}] Approaching timeout, stopping at batch ${i + 1}/${batches.length}`)
        break
      }

      try {
        console.log(`🔄 [${executionId}] Processing batch ${i + 1}/${batches.length} (${batch.length} tokens)`)

        const batchResult = await processPriceBatch(batch, executionId)
        results.push(batchResult)

        totalProcessed += batchResult.processed
        totalErrors += batchResult.errors
        supabaseOperations += batchResult.supabaseOps || 0
        dexscreenerCalls += batchResult.dexscreenerCalls || 0

        if (batchResult.errorDetails && batchResult.errorDetails.length > 0) {
          errorDetails.push(...batchResult.errorDetails)
        }

        const batchDuration = Date.now() - batchStartTime
        console.log(`✅ [${executionId}] Batch ${i + 1} completed in ${batchDuration}ms`)

        // Shorter delay between batches since we're only doing metrics (1s)
        if (i < batches.length - 1) {
          console.log(`⏳ [${executionId}] Waiting 1s before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`❌ [${executionId}] Batch ${i + 1} failed:`, error)
        totalErrors += batch.length

        const errorDetail = {
          batch: i + 1,
          tokens: batch,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }

        errorDetails.push(errorDetail)

        results.push({
          batch: i + 1,
          processed: 0,
          errors: batch.length,
          error: error instanceof Error ? error.message : "Unknown error",
          errorDetails: [errorDetail],
        })

        // If we hit rate limits, wait longer before next batch
        if (error instanceof Error && (error.message.includes("Rate limited") || error.message.includes("Too Many"))) {
          console.log(`⏳ [${executionId}] Rate limited detected, waiting 5s before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    }

    const duration = Date.now() - startTime
    const success = totalErrors === 0

    // Enhanced completion logging with detailed stats
    console.log(`
💰 ========== PRICE REFRESH COMPLETED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
✅ Tokens Processed: ${totalProcessed}
❌ Errors: ${totalErrors}
🔢 Success Rate: ${totalProcessed > 0 ? Math.round((totalProcessed / (totalProcessed + totalErrors)) * 100) : 0}%
🗄️ Database Operations: ${supabaseOperations}
🌐 DexScreener API Calls: ${dexscreenerCalls}
⚡ Mode: PRICE ONLY
==============================================
    `)

    return NextResponse.json({
      success,
      execution_id: executionId,
      message: `Price refresh completed: ${totalProcessed} processed, ${totalErrors} errors`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      tokens_processed: totalProcessed,
      errors: totalErrors,
      supabase_operations: supabaseOperations,
      dexscreener_calls: dexscreenerCalls,
      batches_processed: results.length,
      mode: "price_only",
      results,
      error_details: errorDetails.length > 0 ? errorDetails : undefined,
      test_mode: isManualTest,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`
❌ ========== PRICE REFRESH FAILED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
💥 Error: ${errorMsg}
${error instanceof Error && error.stack ? `📚 Stack: ${error.stack}` : ""}
===========================================
    `)

    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        message: "Price refresh failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        mode: "price_only",
        test_mode: isManualTest,
      },
      { status: 500 },
    )
  }
}

async function processPriceBatch(batch: string[], executionId: string) {
  const batchStartTime = Date.now()
  let processed = 0
  let errors = 0
  let totalSupabaseOps = 0
  let dexscreenerCalls = 0
  const errorDetails = []
  const tokenResults = []

  try {
    const dexscreenerApiUrl = `https://api.dexscreener.com/tokens/v1/hyperevm/${batch.join(",")}`

    console.log(`🔗 [${executionId}] Calling DexScreener API for price batch: ${batch.length} tokens`)

    const fetchStartTime = Date.now()
    dexscreenerCalls++

    const response = await fetch(dexscreenerApiUrl, {
      headers: {
        "User-Agent": "HyperLiquid-Core/1.0",
        Accept: "application/json",
      },
    })
    const fetchDuration = Date.now() - fetchStartTime

    console.log(`⏱️ [${executionId}] DexScreener API call took ${fetchDuration}ms`)

    if (!response.ok) {
      console.error(`❌ [${executionId}] DexScreener API Error: ${response.status} ${response.statusText}`)

      const errorDetail = {
        type: "api_error",
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString(),
        tokens: batch,
      }

      errorDetails.push(errorDetail)
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`)
    }

    const parseStartTime = Date.now()
    const data = await response.json()
    const parseDuration = Date.now() - parseStartTime

    console.log(`⏱️ [${executionId}] JSON parsing took ${parseDuration}ms`)
    console.log(`📊 [${executionId}] DexScreener response: ${Array.isArray(data) ? data.length : 0} pairs found`)

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`⚠️ [${executionId}] No pairs found for batch`)
      return {
        batch: batch,
        processed: 0,
        errors: batch.length,
        message: "No pairs found",
        supabaseOps: 0,
        dexscreenerCalls,
        errorDetails,
      }
    }

    // Process each pair in the batch - PRICE ONLY
    for (const pair of data) {
      try {
        const dbStartTime = Date.now()
        const result = await insertPriceMetrics(pair, executionId)
        const dbDuration = Date.now() - dbStartTime

        console.log(`⏱️ [${executionId}] Price metrics for ${pair.baseToken?.symbol} took ${dbDuration}ms`)

        totalSupabaseOps += result.supabaseOps
        processed++

        tokenResults.push({
          token: pair.baseToken?.symbol,
          address: pair.baseToken?.address,
          duration: dbDuration,
        })

        if (result.error) {
          const errorDetail = {
            type: "metrics_insert_error",
            token: pair.baseToken?.symbol,
            address: pair.baseToken?.address,
            error: result.error,
            timestamp: new Date().toISOString(),
          }
          errorDetails.push(errorDetail)
        }
      } catch (error) {
        console.error(`❌ [${executionId}] Failed to insert metrics for ${pair.baseToken?.symbol}:`, error)
        errors++

        const errorDetail = {
          type: "token_metrics_error",
          token: pair.baseToken?.symbol,
          address: pair.baseToken?.address,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }
        errorDetails.push(errorDetail)
      }
    }
  } catch (error: any) {
    console.error(`❌ [${executionId}] Batch failed:`, error)

    return {
      batch: batch,
      processed: 0,
      errors: batch.length,
      error: error instanceof Error ? error.message : "Unknown error",
      supabaseOps: totalSupabaseOps,
      dexscreenerCalls,
      errorDetails,
      tokenResults,
    }
  }

  const batchDuration = Date.now() - batchStartTime
  console.log(
    `✅ [${executionId}] Price batch completed in ${batchDuration}ms: ${processed} processed, ${errors} errors`,
  )

  return {
    batch: batch,
    processed,
    errors,
    supabaseOps: totalSupabaseOps,
    dexscreenerCalls,
    duration: batchDuration,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    tokenResults,
  }
}

// Simplified function that ONLY inserts price metrics
async function insertPriceMetrics(pair: any, executionId: string) {
  const baseToken = pair.baseToken
  if (!baseToken?.address) {
    throw new Error("No base token address found")
  }

  console.log(`💰 [${executionId}] Inserting price metrics for ${baseToken.symbol}`)

  let supabaseOps = 0

  try {
    // Insert new metrics record (time-series data) - ONLY THIS
    const metricsData = {
      contract_address: baseToken.address,
      price_usd: pair.priceUsd ? Number.parseFloat(pair.priceUsd) : null,
      market_cap: pair.marketCap ? Number.parseFloat(pair.marketCap) : null,
      fdv: pair.fdv ? Number.parseFloat(pair.fdv) : null,
      price_change_30m: pair.priceChange?.h1 ? Number.parseFloat(pair.priceChange.h1) : null,
      price_change_24h: pair.priceChange?.h24 ? Number.parseFloat(pair.priceChange.h24) : null,
      volume_24h: pair.volume?.h24 ? Number.parseFloat(pair.volume.h24) : null,
      liquidity_usd: pair.liquidity?.usd ? Number.parseFloat(pair.liquidity.usd) : null,
      recorded_at: new Date().toISOString(),
    }

    const { error: metricsError } = await supabase.from("token_metrics").insert([metricsData])
    supabaseOps++

    if (metricsError) {
      console.error(`❌ [${executionId}] Price metrics insert failed for ${baseToken.symbol}: ${metricsError.message}`)
      return {
        supabaseOps,
        error: `Metrics insert failed: ${metricsError.message}`,
      }
    }

    console.log(`✅ [${executionId}] Price metrics inserted for ${baseToken.symbol}`)

    return {
      supabaseOps,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ [${executionId}] Price metrics failed for ${baseToken.symbol}: ${errorMsg}`)

    return {
      supabaseOps,
      error: errorMsg,
    }
  }
}

// Utility function to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
