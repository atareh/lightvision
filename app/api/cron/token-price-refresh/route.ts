import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("🔴 CRITICAL: Supabase URL or Service Key is missing for token-price-refresh.")
}
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  console.log(`
💰 ========== PRICE REFRESH STARTED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
🔧 Type: ${isManualTest ? "Manual Test" : "Scheduled Cron"}
⚡ Mode: PRICE ONLY (no social data)
==============================================
`)

  try {
    if (requireAuth) {
      const authHeader = request.headers.get("authorization")
      const debugPassword = request.headers.get("x-debug-password")
      const isValidCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
      const isValidDebug = debugPassword === process.env.DEBUG_PASSWORD

      if (!isValidCron && !isValidDebug) {
        console.error(`❌ [${executionId}] UNAUTHORIZED ACCESS ATTEMPT - Missing or invalid credentials`)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      // ... logging for cron/debug trigger
    }

    console.log(`📋 [${executionId}] Fetching enabled tokens from database...`)
    const dbFetchStart = Date.now()
    const { data: tokensFromDb, error: fetchError } = await supabase
      .from("tokens")
      .select("contract_address") // Only select what's needed
      .eq("enabled", true)
      .eq("is_hidden", false) // <-- ADD THIS LINE
    const dbFetchDuration = Date.now() - dbFetchStart

    if (fetchError) {
      console.error(`❌ [${executionId}] DATABASE ERROR: Failed to fetch tokens: ${fetchError.message}`)
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`)
    }
    console.log(`✅ [${executionId}] Database fetch completed in ${dbFetchDuration}ms`)

    if (!tokensFromDb || tokensFromDb.length === 0) {
      console.log(`⚠️ [${executionId}] No enabled tokens found`)
      return NextResponse.json({
        success: true,
        message: "No enabled tokens to refresh",
        execution_id: executionId,
        tokens_processed: 0,
      })
    }

    console.log(`📋 [${executionId}] Found ${tokensFromDb.length} enabled tokens to refresh`)
    // Ensure all addresses from DB are lowercase for consistent checking later
    const contractAddresses = tokensFromDb.map((t) => t.contract_address.toLowerCase())
    const batches = chunkArray(contractAddresses, 30)

    console.log(`📦 [${executionId}] Processing ${batches.length} batches (price data only)`)
    let totalProcessed = 0
    let totalErrors = 0
    let supabaseOperations = 0
    let dexscreenerCalls = 0
    const results = []
    const errorDetails = []

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i] // batch contains lowercased addresses
      const batchStartTime = Date.now()

      // Safety check - abort if we're approaching timeout (85s limit)
      if (Date.now() - startTime > 85000) {
        console.log(`⏰ [${executionId}] Approaching timeout, stopping at batch ${i + 1}/${batches.length}`)
        break
      }

      try {
        console.log(`🔄 [${executionId}] Processing batch ${i + 1}/${batches.length} (${batch.length} tokens)`)
        // Pass the original batch (which is already lowercased) for validation inside processPriceBatch
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

        if (error instanceof Error && (error.message.includes("Rate limited") || error.message.includes("Too Many"))) {
          console.log(`⏳ [${executionId}] Rate limited detected, waiting 5s before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    }

    const duration = Date.now() - startTime
    const success = totalErrors === 0

    console.log(`
💰 ========== PRICE REFRESH COMPLETED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
✅ Tokens Processed: ${totalProcessed}
❌ Errors: ${totalErrors}
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
        message: "Price refresh failed",
        error: errorMsg,
        execution_id: executionId,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        mode: "price_only",
        test_mode: isManualTest,
      },
      { status: 500 },
    )
  }
}

async function processPriceBatch(batchOfAddresses: string[], executionId: string) {
  // batchOfAddresses are already lowercased from the main function
  let processed = 0
  let errors = 0
  let totalSupabaseOps = 0
  let dexscreenerCalls = 0
  const errorDetails = []
  const tokenResults = []

  try {
    const dexscreenerApiUrl = `https://api.dexscreener.com/tokens/v1/hyperevm/${batchOfAddresses.join(",")}` // Using the user's original endpoint structure

    console.log(
      `🔗 [${executionId}] Calling DexScreener API for price batch: ${batchOfAddresses.length} tokens. URL: ${dexscreenerApiUrl}`,
    )
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
      errors += batchOfAddresses.length
      errorDetails.push({ type: "api_error", status: response.status, tokens: batchOfAddresses })
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const parseStartTime = Date.now()
    const responseData = await response.json()
    const parseDuration = Date.now() - parseStartTime

    console.log(`⏱️ [${executionId}] JSON parsing took ${parseDuration}ms`)
    console.log(
      `📊 [${executionId}] DexScreener response: ${Array.isArray(responseData) ? responseData.length : 0} pairs found`,
    )

    if (!Array.isArray(responseData)) {
      console.warn(`[${executionId}] Unexpected API response format. Expected array. Got:`, typeof responseData)
      errors += batchOfAddresses.length
      errorDetails.push({ type: "api_response_format_error", message: "Expected array", tokens: batchOfAddresses })
      return { processed, errors, errorDetails, supabaseOps: totalSupabaseOps, dexscreenerCalls } // Or throw
    }

    for (const item of responseData) {
      // Changed from 'pair' to 'item' for clarity
      const baseTokenAddress = item.baseToken?.address?.toLowerCase()
      const baseTokenSymbol = item.baseToken?.symbol

      if (!baseTokenAddress) {
        console.warn(
          `[${executionId}] Skipping item due to missing baseToken address. Item: ${JSON.stringify(item).slice(0, 100)}`,
        )
        errors++
        errorDetails.push({
          type: "missing_data",
          message: "Missing baseToken address",
          token_symbol: baseTokenSymbol || "Unknown",
        })
        continue
      }

      // Defensive Check: Ensure this baseTokenAddress was in our original request batch
      // batchOfAddresses is already lowercased.
      if (!batchOfAddresses.includes(baseTokenAddress)) {
        console.warn(
          `[${executionId}] DexScreener returned token ${baseTokenSymbol} (${baseTokenAddress}) which was not in the current DB query batch. Skipping metrics insertion.`,
        )
        errorDetails.push({ type: "unexpected_token", token_symbol: baseTokenSymbol, address: baseTokenAddress })
        continue
      }

      try {
        const dbStartTime = Date.now()
        // Pass the whole 'item' which is expected to be the 'pair' object by insertPriceMetrics
        const result = await insertPriceMetrics(item, executionId) // insertPriceMetrics will also lowercase baseToken.address
        const dbDuration = Date.now() - dbStartTime

        console.log(`⏱️ [${executionId}] Price metrics for ${baseTokenSymbol} took ${dbDuration}ms`)

        totalSupabaseOps += result.supabaseOps || 0
        dexscreenerCalls++
        tokenResults.push({
          token: baseTokenSymbol,
          address: baseTokenAddress,
          duration: dbDuration,
        })

        if (result.error) {
          errors++
          errorDetails.push({
            type: "metrics_insert_error",
            token_symbol: baseTokenSymbol,
            address: baseTokenAddress,
            error: result.error,
          })
        } else {
          processed++
        }
      } catch (e: any) {
        errors++
        errorDetails.push({
          type: "metrics_insert_exception",
          token_symbol: baseTokenSymbol,
          address: baseTokenAddress,
          error: e.message,
        })
        console.error(
          `[${executionId}] Error processing metrics for ${baseTokenSymbol} (${baseTokenAddress}): ${e.message}`,
        )
      }
    }
  } catch (error: any) {
    console.error(`❌ [${executionId}] Batch failed:`, error.message)
    if (!errorDetails.find((ed) => ed.type === "api_error")) {
      errorDetails.push({ type: "batch_processing_error", error: error.message, tokens: batchOfAddresses })
    }
    if (processed === 0 && errors === 0 && batchOfAddresses.length > 0) {
      errors = batchOfAddresses.length
    }
  }
  return { processed, errors, errorDetails, supabaseOps: totalSupabaseOps, dexscreenerCalls, tokenResults }
}

async function insertPriceMetrics(pairData: any, executionId: string) {
  // pairData is an item from the DexScreener response array
  const baseToken = pairData.baseToken
  if (!baseToken?.address || typeof baseToken.address !== "string") {
    // Added type check for address
    console.warn(
      `[${executionId}] No valid baseToken.address found in pairData. Skipping metrics. Data: ${JSON.stringify(pairData).slice(0, 100)}`,
    )
    return { error: "No valid baseToken.address found", supabaseOps: 0 }
  }

  const contractAddress = baseToken.address.toLowerCase() // Ensure lowercase
  const tokenSymbol = baseToken.symbol || "Unknown"

  console.log(`💰 [${executionId}] Inserting price metrics for ${tokenSymbol} (Address: ${contractAddress})`)

  let supabaseOps = 0

  try {
    const metricsData = {
      contract_address: contractAddress, // Use lowercased address
      price_usd: pairData.priceUsd ? Number.parseFloat(pairData.priceUsd) : null,
      market_cap: pairData.marketCap ? Number.parseFloat(pairData.marketCap) : null,
      fdv: pairData.fdv ? Number.parseFloat(pairData.fdv) : null,
      price_change_30m: pairData.priceChange?.h1 ? Number.parseFloat(pairData.priceChange.h1) : null, // Assuming h1 is 30m/1h
      price_change_24h: pairData.priceChange?.h24 ? Number.parseFloat(pairData.priceChange.h24) : null,
      volume_24h: pairData.volume?.h24 ? Number.parseFloat(pairData.volume.h24) : null,
      liquidity_usd: pairData.liquidity?.usd ? Number.parseFloat(pairData.liquidity.usd) : null,
      recorded_at: new Date().toISOString(),
    }

    const { error: metricsError } = await supabase.from("token_metrics").insert([metricsData])
    supabaseOps++

    if (metricsError) {
      console.error(
        `❌ [${executionId}] Price metrics insert failed for ${tokenSymbol} (${contractAddress}): ${metricsError.message}`,
      )
      return { error: `Metrics insert failed: ${metricsError.message}`, supabaseOps }
    }

    console.log(`✅ [${executionId}] Price metrics inserted for ${tokenSymbol} (${contractAddress})`)
    return { error: null, supabaseOps } // Success
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ [${executionId}] Price metrics failed for ${tokenSymbol} (${contractAddress}): ${errorMsg}`)

    return {
      supabaseOps,
      error: errorMsg,
    }
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
