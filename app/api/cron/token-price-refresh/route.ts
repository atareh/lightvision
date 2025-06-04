import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("🔴 CRITICAL: Supabase URL or Service Key is missing for token-price-refresh.")
  // throw new Error("Supabase credentials are not configured."); // Optional: hard fail
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
    let hyperscanCalls = 0 // <-- ADD THIS LINE
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
        hyperscanCalls += batchResult.hyperscanCalls || 0 // <-- ADD THIS LINE

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
      hyperscan_calls: hyperscanCalls, // <-- ADD THIS LINE
      batches_processed: results.length,
      mode: "price_and_holders", // <-- UPDATE THIS LINE
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
  // batchOfAddresses are already lowercased
  let processedCount = 0
  let errorCount = 0
  let supabaseOpsCount = 0
  let dexscreenerCallsCount = 0
  let hyperscanCallsCount = 0
  const batchErrorDetails: any[] = []
  const batchTokenResults: any[] = []

  // 1. Fetch DexScreener data for the current batch
  const dexscreenerDataMap = new Map<string, any>()
  if (batchOfAddresses.length > 0) {
    const dexscreenerApiUrl = `https://api.dexscreener.com/tokens/v1/hyperevm/${batchOfAddresses.join(",")}`
    console.log(
      `🔗 [${executionId}] Calling DexScreener API for batch: ${batchOfAddresses.length} tokens. URL: ${dexscreenerApiUrl}`,
    )
    const dsFetchStart = Date.now()
    dexscreenerCallsCount++
    try {
      const dsResponse = await fetch(dexscreenerApiUrl, {
        headers: { "User-Agent": "HyperLiquid-Core/1.0", Accept: "application/json" },
      })
      console.log(
        `⏱️ [${executionId}] DexScreener API call took ${Date.now() - dsFetchStart}ms. Status: ${dsResponse.status}`,
      )
      if (dsResponse.ok) {
        const dsData = await dsResponse.json()
        if (Array.isArray(dsData)) {
          dsData.forEach((item) => {
            if (item.baseToken?.address) {
              dexscreenerDataMap.set(item.baseToken.address.toLowerCase(), item)
            }
          })
          console.log(
            `📊 [${executionId}] DexScreener response: ${dsData.length} pairs found, mapped ${dexscreenerDataMap.size} tokens.`,
          )
        } else {
          console.warn(`[${executionId}] DexScreener response was not an array for batch.`)
          batchErrorDetails.push({
            type: "dexscreener_response_format_error",
            message: "Expected array",
            tokens: batchOfAddresses,
          })
        }
      } else {
        console.error(`❌ [${executionId}] DexScreener API error for batch: ${dsResponse.status}`)
        batchErrorDetails.push({ type: "dexscreener_api_error", status: dsResponse.status, tokens: batchOfAddresses })
      }
    } catch (e: any) {
      console.error(`❌ [${executionId}] DexScreener API fetch failed for batch: ${e.message}`)
      batchErrorDetails.push({ type: "dexscreener_fetch_exception", error: e.message, tokens: batchOfAddresses })
    }
  }

  // 2. Iterate through each address in the original batch to fetch holder counts and upsert metrics
  for (const address of batchOfAddresses) {
    // address is already lowercased
    const dexscreenerItem = dexscreenerDataMap.get(address)
    let holderCountStr: string | null = null
    const tokenSymbolForLogs = dexscreenerItem?.baseToken?.symbol || address.slice(0, 6) + "..."

    try {
      console.log(`🔎 [${executionId}] Fetching holder count for ${tokenSymbolForLogs} (${address})`)
      const hyperScanUrl = `https://www.hyperscan.com/api/v2/tokens/${address}/counters`
      const hsFetchStart = Date.now()
      hyperscanCallsCount++
      const hyperScanResponse = await fetch(hyperScanUrl, { headers: { "User-Agent": "HyperLiquid-Core/1.0" } })

      console.log(
        `⏱️ [${executionId}] HyperScan call for ${tokenSymbolForLogs} (${address}) took ${Date.now() - hsFetchStart}ms. Status: ${hyperScanResponse.status}`,
      )

      if (hyperScanResponse.ok) {
        const scanData = await hyperScanResponse.json()
        if (scanData && typeof scanData.token_holders_count === "string") {
          holderCountStr = scanData.token_holders_count
          console.log(`✅ [${executionId}] Holder count for ${tokenSymbolForLogs} (${address}): ${holderCountStr}`)
        } else {
          console.warn(
            `[${executionId}] Invalid or missing holder count data for ${tokenSymbolForLogs} (${address}):`,
            scanData,
          )
          batchErrorDetails.push({ type: "hyperscan_data_format_error", token_symbol: tokenSymbolForLogs, address })
        }
      } else {
        console.warn(
          `[${executionId}] Failed to fetch holder count for ${tokenSymbolForLogs} (${address}): ${hyperScanResponse.status}`,
        )
        batchErrorDetails.push({
          type: "hyperscan_api_error",
          status: hyperScanResponse.status,
          token_symbol: tokenSymbolForLogs,
          address,
        })
      }
      // Polite delay for HyperScan API
      await new Promise((resolve) => setTimeout(resolve, 250)) // 250ms delay
    } catch (e: any) {
      console.error(
        `❌ [${executionId}] Error fetching/processing holder count for ${tokenSymbolForLogs} (${address}): ${e.message}`,
      )
      batchErrorDetails.push({
        type: "hyperscan_fetch_exception",
        error: e.message,
        token_symbol: tokenSymbolForLogs,
        address,
      })
    }

    const upsertResult = await upsertTokenMetrics(address, dexscreenerItem, holderCountStr, executionId)
    supabaseOpsCount += upsertResult.supabaseOps

    if (upsertResult.error) {
      errorCount++ // Only count actual DB/processing errors here
      batchErrorDetails.push({
        type: "metrics_upsert_error",
        token_symbol: tokenSymbolForLogs,
        address: address,
        error: upsertResult.error,
      })
    } else if (!upsertResult.noNewData) {
      processedCount++
    }
    batchTokenResults.push({
      token: tokenSymbolForLogs,
      address,
      status: upsertResult.error ? "error" : upsertResult.noNewData ? "no_new_data" : "success",
    })
  }

  // Consolidate errors: API errors from DexScreener/HyperScan might affect multiple tokens or the whole batch
  const apiErrorCount = batchErrorDetails.filter(
    (e) => e.type.startsWith("dexscreener_") || e.type.startsWith("hyperscan_api_error"),
  ).length

  return {
    processed: processedCount,
    errors: errorCount + apiErrorCount, // Sum of DB errors and critical API errors
    errorDetails: batchErrorDetails,
    supabaseOps: supabaseOpsCount,
    dexscreenerCalls: dexscreenerCallsCount,
    hyperscanCalls: hyperscanCallsCount,
    tokenResults: batchTokenResults,
  }
}

async function upsertTokenMetrics(
  contractAddress: string, // already lowercased
  dexscreenerPairData: any | null,
  holderCountStr: string | null,
  executionId: string,
) {
  const tokenSymbolForLogs = dexscreenerPairData?.baseToken?.symbol || contractAddress.slice(0, 6) + "..."
  let supabaseOps = 0

  const metricsData: { [key: string]: any } = {
    contract_address: contractAddress,
    recorded_at: new Date().toISOString(),
  }

  let hasNewPriceData = false
  if (dexscreenerPairData) {
    metricsData.price_usd = dexscreenerPairData.priceUsd ? Number.parseFloat(dexscreenerPairData.priceUsd) : null
    metricsData.market_cap = dexscreenerPairData.marketCap ? Number.parseFloat(dexscreenerPairData.marketCap) : null
    metricsData.fdv = dexscreenerPairData.fdv ? Number.parseFloat(dexscreenerPairData.fdv) : null
    metricsData.price_change_30m = dexscreenerPairData.priceChange?.h1
      ? Number.parseFloat(dexscreenerPairData.priceChange.h1)
      : null
    metricsData.price_change_24h = dexscreenerPairData.priceChange?.h24
      ? Number.parseFloat(dexscreenerPairData.priceChange.h24)
      : null
    metricsData.volume_24h = dexscreenerPairData.volume?.h24 ? Number.parseFloat(dexscreenerPairData.volume.h24) : null
    metricsData.liquidity_usd = dexscreenerPairData.liquidity?.usd
      ? Number.parseFloat(dexscreenerPairData.liquidity.usd)
      : null
    if (metricsData.price_usd !== null || metricsData.market_cap !== null || metricsData.volume_24h !== null) {
      hasNewPriceData = true
    }
  }

  let hasNewHolderData = false
  if (holderCountStr !== null) {
    const parsedHolderCount = Number.parseInt(holderCountStr, 10)
    if (!isNaN(parsedHolderCount)) {
      metricsData.holder_count = parsedHolderCount
      hasNewHolderData = true
    } else {
      metricsData.holder_count = null
      console.warn(
        `[${executionId}] Failed to parse holder count '${holderCountStr}' for ${tokenSymbolForLogs} (${contractAddress})`,
      )
    }
  }

  if (!hasNewPriceData && !hasNewHolderData) {
    console.log(
      `[${executionId}] No new price or holder data for ${tokenSymbolForLogs} (${contractAddress}). Skipping metrics insert.`,
    )
    return { error: null, supabaseOps, noNewData: true }
  }

  console.log(
    `💾 [${executionId}] Upserting metrics for ${tokenSymbolForLogs} (${contractAddress}). Price data: ${hasNewPriceData}, Holder data: ${hasNewHolderData}`,
  )

  try {
    const { error: metricsError } = await supabase.from("token_metrics").insert([metricsData])
    supabaseOps++

    if (metricsError) {
      console.error(
        `❌ [${executionId}] Metrics upsert failed for ${tokenSymbolForLogs} (${contractAddress}): ${metricsError.message}. Data: ${JSON.stringify(metricsData)}`,
      )
      return { error: `Metrics upsert failed: ${metricsError.message}`, supabaseOps, noNewData: false }
    }

    console.log(`✅ [${executionId}] Metrics upserted for ${tokenSymbolForLogs} (${contractAddress})`)
    return { error: null, supabaseOps, noNewData: false }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(
      `❌ [${executionId}] Metrics upsert exception for ${tokenSymbolForLogs} (${contractAddress}): ${errorMsg}`,
    )
    return { supabaseOps, error: errorMsg, noNewData: false }
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
