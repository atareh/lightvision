import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkAndUpdateLiquidityStatus, getActiveLiquidityTokens } from "@/lib/liquidity-filter"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  return handleTokenRefresh(request, true) // true = require auth for GET (real cron)
}

export async function POST(request: NextRequest) {
  return handleTokenRefresh(request, true) // CHANGED: Now requires auth for POST too
}

async function handleTokenRefresh(request: NextRequest, requireAuth: boolean) {
  const executionId = `token_refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  const isManualTest = request.headers.get("x-debug-password") === process.env.DEBUG_PASSWORD

  // Enhanced logging - add timestamp and execution type
  console.log(`
🔄 ========== TOKEN REFRESH STARTED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
🔧 Type: ${isManualTest ? "Manual Test" : "Scheduled Cron"}
==============================================
  `)

  try {
    // SECURITY: Always verify authorization now
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
        console.log(`🪙 [${executionId}] Token refresh cron job triggered (1-minute interval)`)
      } else {
        console.log(`🪙 [${executionId}] Token refresh manual test triggered (authenticated)`)
      }
    }

    // Get only active tokens (enabled=true AND low_liquidity=false)
    console.log(`📋 [${executionId}] Fetching active tokens (sufficient liquidity) from database...`)
    const dbFetchStart = Date.now()

    const contractAddresses = await getActiveLiquidityTokens()
    const dbFetchDuration = Date.now() - dbFetchStart

    console.log(`✅ [${executionId}] Database fetch completed in ${dbFetchDuration}ms`)

    if (!contractAddresses || contractAddresses.length === 0) {
      console.log(`⚠️ [${executionId}] No active tokens found (all may be below liquidity threshold)`)
      return NextResponse.json({
        success: true,
        message: "No active tokens to refresh (liquidity filter applied)",
        execution_id: executionId,
        tokens_processed: 0,
      })
    }

    console.log(
      `📋 [${executionId}] Found ${contractAddresses.length} active tokens to refresh (liquidity filter applied)`,
    )

    // Chunk tokens into smaller batches of 5 (very conservative)
    const batches = chunkArray(contractAddresses, 5)

    console.log(`📦 [${executionId}] Processing ${batches.length} batches`)

    let totalProcessed = 0
    let totalErrors = 0
    let supabaseOperations = 0
    let dexscreenerCalls = 0
    let liquidityUpdates = 0
    const results = []
    const errorDetails = []

    // Process batches with timeout safety and rate limiting
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

        const batchResult = await processBatch(batch, executionId)
        results.push(batchResult)

        totalProcessed += batchResult.processed
        totalErrors += batchResult.errors
        supabaseOperations += batchResult.supabaseOps || 0
        dexscreenerCalls += batchResult.dexscreenerCalls || 0
        liquidityUpdates += batchResult.liquidityUpdates || 0

        if (batchResult.errorDetails && batchResult.errorDetails.length > 0) {
          errorDetails.push(...batchResult.errorDetails)
        }

        const batchDuration = Date.now() - batchStartTime
        console.log(`✅ [${executionId}] Batch ${i + 1} completed in ${batchDuration}ms`)

        // Longer delay between batches to respect ALL rate limits (3s)
        if (i < batches.length - 1) {
          console.log(`⏳ [${executionId}] Waiting 3s before next batch to respect rate limits...`)
          await new Promise((resolve) => setTimeout(resolve, 3000))
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
          console.log(`⏳ [${executionId}] Rate limited detected, waiting 15s before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 15000))
        }
      }
    }

    const duration = Date.now() - startTime
    const success = totalErrors === 0

    // Enhanced completion logging with detailed stats
    console.log(`
🎯 ========== TOKEN REFRESH COMPLETED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
✅ Tokens Processed: ${totalProcessed}
❌ Errors: ${totalErrors}
🔢 Success Rate: ${totalProcessed > 0 ? Math.round((totalProcessed / (totalProcessed + totalErrors)) * 100) : 0}%
🗄️ Database Operations: ${supabaseOperations}
🌐 DexScreener API Calls: ${dexscreenerCalls}
💧 Liquidity Updates: ${liquidityUpdates}
==============================================
    `)

    // Log any errors in detail
    if (errorDetails.length > 0) {
      console.error(`
❌ ========== ERROR DETAILS ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
🔢 Total Errors: ${errorDetails.length}
${errorDetails
  .map(
    (err, i) => `
  Error #${i + 1}:
  - Batch: ${err.batch}
  - Tokens: ${err.tokens ? err.tokens.join(", ").substring(0, 100) + (err.tokens.join(", ").length > 100 ? "..." : "") : "N/A"}
  - Error: ${err.error}
  - Time: ${err.timestamp}
`,
  )
  .join("")}
======================================
      `)
    }

    return NextResponse.json({
      success,
      execution_id: executionId,
      message: `Token refresh completed: ${totalProcessed} processed, ${totalErrors} errors, ${liquidityUpdates} liquidity updates`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      tokens_processed: totalProcessed,
      errors: totalErrors,
      supabase_operations: supabaseOperations,
      dexscreener_calls: dexscreenerCalls,
      liquidity_updates: liquidityUpdates,
      batches_processed: results.length,
      results,
      error_details: errorDetails.length > 0 ? errorDetails : undefined,
      test_mode: isManualTest,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    // Enhanced error logging for critical failures
    console.error(`
❌ ========== TOKEN REFRESH FAILED ==========
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
        message: "Token refresh failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        test_mode: isManualTest,
      },
      { status: 500 },
    )
  }
}

async function updateTokenData(pair: any, executionId: string) {
  const baseToken = pair.baseToken
  if (!baseToken?.address) {
    throw new Error("No base token address found")
  }

  console.log(`🔍 [${executionId}] Processing token ${baseToken.symbol} (${baseToken.address})`)

  // Log the raw social/website data for debugging
  if (pair.info?.socials || pair.info?.websites) {
    console.log(
      `📱 [${executionId}] Raw social data for ${baseToken.symbol}:`,
      JSON.stringify(pair.info.socials, null, 2),
    )
    console.log(
      `🌐 [${executionId}] Raw website data for ${baseToken.symbol}:`,
      JSON.stringify(pair.info.websites, null, 2),
    )
  }

  let supabaseOps = 0
  let liquidityUpdates = 0
  const tokenUpdateStart = Date.now()
  const operations = {
    fetchExisting: 0,
    upsertToken: 0,
    insertMetrics: 0,
    liquidityCheck: 0,
    errors: [],
  }

  try {
    // First, check if token already exists and if it has manual_image flag
    console.log(`🔍 [${executionId}] Checking existing token data for ${baseToken.symbol}`)
    const fetchStart = Date.now()

    const { data: existingToken, error: fetchError } = await supabase
      .from("tokens")
      .select("image_url, manual_image")
      .eq("contract_address", baseToken.address)
      .single()

    operations.fetchExisting = Date.now() - fetchStart
    supabaseOps++

    if (fetchError && !fetchError.message.includes("No rows found")) {
      console.error(`❌ [${executionId}] Database fetch error for ${baseToken.symbol}: ${fetchError.message}`)
      operations.errors.push({
        operation: "fetch_existing",
        error: fetchError.message,
        duration: operations.fetchExisting,
      })
    }

    // Determine image URL: preserve if manual_image=true, otherwise use API data
    let imageUrl
    if (existingToken?.manual_image) {
      // Keep existing image for manually flagged tokens
      imageUrl = existingToken.image_url
      console.log(`🔒 [${executionId}] Preserving manual image for ${baseToken.symbol} (manual_image=true)`)
    } else {
      // Use API data for all other tokens
      imageUrl = pair.info?.imageUrl || baseToken.image || null
    }

    // Prepare token metadata
    const tokenMetadata: any = {
      id: baseToken.address,
      contract_address: baseToken.address,
      name: baseToken.name || null,
      symbol: baseToken.symbol || null,
      pair_address: pair.pairAddress || null,
      pair_created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
      dex_id: pair.dexId || null,
      chain_id: pair.chainId || "hyperevm",
      updated_at: new Date().toISOString(),
    }

    // Only include image_url if it's not a manual image token
    if (!existingToken?.manual_image) {
      tokenMetadata.image_url = imageUrl
    } else {
      // For manual image tokens, preserve existing image_url
      tokenMetadata.image_url = existingToken.image_url
    }

    // Process social data from DexScreener API
    if (pair.info?.socials && Array.isArray(pair.info.socials) && pair.info.socials.length > 0) {
      // Transform "type" to "platform" for frontend compatibility
      const processedSocials = pair.info.socials.map((social: any) => ({
        platform: social.type, // Transform "type" to "platform"
        url: social.url,
      }))

      tokenMetadata.socials = processedSocials
      console.log(
        `📱 [${executionId}] Processed ${processedSocials.length} social links for ${baseToken.symbol}:`,
        processedSocials,
      )
    } else {
      // Explicitly set to empty array if no socials
      tokenMetadata.socials = []
      console.log(`📱 [${executionId}] No social links found for ${baseToken.symbol}`)
    }

    // Process website data from DexScreener API
    if (pair.info?.websites && Array.isArray(pair.info.websites) && pair.info.websites.length > 0) {
      tokenMetadata.websites = pair.info.websites
      console.log(
        `🌐 [${executionId}] Processed ${pair.info.websites.length} websites for ${baseToken.symbol}:`,
        pair.info.websites,
      )
    } else {
      // Explicitly set to empty array if no websites
      tokenMetadata.websites = []
      console.log(`🌐 [${executionId}] No websites found for ${baseToken.symbol}`)
    }

    console.log(`💾 [${executionId}] Final token metadata for ${baseToken.symbol}:`, {
      contract_address: tokenMetadata.contract_address,
      symbol: tokenMetadata.symbol,
      socials: tokenMetadata.socials,
      websites: tokenMetadata.websites,
      image_url: tokenMetadata.image_url,
    })

    // Add small delay before database operations to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Upsert token metadata
    console.log(`💾 [${executionId}] Upserting token metadata for ${baseToken.symbol}`)
    const upsertStart = Date.now()

    const { error: tokenError } = await supabase.from("tokens").upsert(tokenMetadata, {
      onConflict: "contract_address",
      ignoreDuplicates: false,
    })

    operations.upsertToken = Date.now() - upsertStart
    supabaseOps++

    if (tokenError) {
      console.error(`❌ [${executionId}] Token metadata upsert failed for ${baseToken.symbol}: ${tokenError.message}`)
      operations.errors.push({
        operation: "upsert_token",
        error: tokenError.message,
        duration: operations.upsertToken,
      })
      throw new Error(`Token metadata upsert failed: ${tokenError.message}`)
    }

    console.log(
      `✅ [${executionId}] Successfully updated token metadata for ${baseToken.symbol} in ${operations.upsertToken}ms`,
    )

    // Add small delay before metrics insert
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Insert new metrics record (time-series data)
    const liquidityUsd = pair.liquidity?.usd ? Number.parseFloat(pair.liquidity.usd) : null
    const metricsData = {
      contract_address: baseToken.address,
      price_usd: pair.priceUsd ? Number.parseFloat(pair.priceUsd) : null,
      market_cap: pair.marketCap ? Number.parseFloat(pair.marketCap) : null,
      fdv: pair.fdv ? Number.parseFloat(pair.fdv) : null,
      price_change_30m: pair.priceChange?.h1 ? Number.parseFloat(pair.priceChange.h1) : null,
      price_change_24h: pair.priceChange?.h24 ? Number.parseFloat(pair.priceChange.h24) : null,
      volume_24h: pair.volume?.h24 ? Number.parseFloat(pair.volume.h24) : null,
      liquidity_usd: liquidityUsd,
      recorded_at: new Date().toISOString(),
    }

    // Insert new metrics record
    console.log(`📊 [${executionId}] Inserting metrics for ${baseToken.symbol}`)
    const metricsStart = Date.now()

    const { error: metricsError } = await supabase.from("token_metrics").insert([metricsData])

    operations.insertMetrics = Date.now() - metricsStart
    supabaseOps++

    if (metricsError) {
      console.error(`❌ [${executionId}] Token metrics insert failed for ${baseToken.symbol}: ${metricsError.message}`)
      operations.errors.push({
        operation: "insert_metrics",
        error: metricsError.message,
        duration: operations.insertMetrics,
      })
      throw new Error(`Token metrics insert failed: ${metricsError.message}`)
    }

    console.log(
      `✅ [${executionId}] Successfully updated metrics for ${baseToken.symbol} in ${operations.insertMetrics}ms`,
    )

    // Check and update liquidity status
    const liquidityStart = Date.now()
    const liquidityUpdated = await checkAndUpdateLiquidityStatus(baseToken.address, liquidityUsd, executionId)
    operations.liquidityCheck = Date.now() - liquidityStart

    if (liquidityUpdated) {
      liquidityUpdates++
    }

    const totalDuration = Date.now() - tokenUpdateStart
    console.log(`✅ [${executionId}] Total token update for ${baseToken.symbol} completed in ${totalDuration}ms`)

    return {
      supabaseOps,
      liquidityUpdates,
      operations,
      duration: totalDuration,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ [${executionId}] Database operations failed for ${baseToken.symbol}: ${errorMsg}`)

    operations.errors.push({
      operation: "overall_process",
      error: errorMsg,
      duration: Date.now() - tokenUpdateStart,
    })

    return {
      supabaseOps,
      liquidityUpdates,
      operations,
      error: errorMsg,
      duration: Date.now() - tokenUpdateStart,
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

async function processBatch(batch: string[], executionId: string) {
  const batchStartTime = Date.now()
  let processed = 0
  let errors = 0
  let totalSupabaseOps = 0
  let totalLiquidityUpdates = 0
  let dexscreenerCalls = 0
  const errorDetails = []
  const tokenResults = []

  try {
    // Enhanced logging to identify the source of rate limits
    const dexscreenerApiUrl = `https://api.dexscreener.com/tokens/v1/hyperevm/${batch.join(",")}`

    console.log(`🔗 [${executionId}] Calling DexScreener API for batch: ${dexscreenerApiUrl}`)
    console.log(`📝 [${executionId}] Batch addresses: ${batch.slice(0, 3).join(", ")}${batch.length > 3 ? "..." : ""}`)

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

    // Enhanced error logging with response headers
    if (!response.ok) {
      console.error(`❌ [${executionId}] DexScreener API Error:`)
      console.error(`   Status: ${response.status} ${response.statusText}`)
      console.error(`   URL: ${dexscreenerApiUrl}`)
      console.error(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

      // Check for rate limit headers
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining")
      const rateLimitReset = response.headers.get("x-ratelimit-reset")
      if (rateLimitRemaining || rateLimitReset) {
        console.error(`   Rate Limit Info: remaining=${rateLimitRemaining}, reset=${rateLimitReset}`)
      }

      // Try to get response body for more details
      let errorBody = "Could not read response body"
      try {
        errorBody = await response.text()
        console.error(`   Response Body: ${errorBody.substring(0, 200)}...`)

        // Check if this is actually a Supabase error somehow
        if (errorBody.includes("supabase") || errorBody.includes("postgres")) {
          console.error(`🚨 [${executionId}] POTENTIAL SUPABASE ERROR DETECTED IN DEXSCREENER RESPONSE!`)
        }
      } catch (e) {
        console.error(`   Could not read response body`)
      }

      const errorDetail = {
        type: "api_error",
        status: response.status,
        statusText: response.statusText,
        body: errorBody.substring(0, 500),
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

      const errorDetail = {
        type: "no_data",
        message: "No pairs found for batch",
        timestamp: new Date().toISOString(),
        tokens: batch,
      }

      errorDetails.push(errorDetail)

      return {
        batch: batch,
        processed: 0,
        errors: batch.length,
        message: "No pairs found",
        supabaseOps: 0,
        liquidityUpdates: 0,
        dexscreenerCalls,
        errorDetails,
      }
    }

    // Process each pair in the batch
    for (const pair of data) {
      try {
        const dbStartTime = Date.now()
        const result = await updateTokenData(pair, executionId)
        const dbDuration = Date.now() - dbStartTime

        console.log(
          `⏱️ [${executionId}] Database operations for ${pair.baseToken?.symbol} took ${dbDuration}ms (${result.supabaseOps} ops, ${result.liquidityUpdates} liquidity updates)`,
        )

        totalSupabaseOps += result.supabaseOps
        totalLiquidityUpdates += result.liquidityUpdates
        processed++

        tokenResults.push({
          token: pair.baseToken?.symbol,
          address: pair.baseToken?.address,
          duration: dbDuration,
          operations: result.operations,
          liquidityUpdates: result.liquidityUpdates,
        })

        if (result.error || (result.operations && result.operations.errors && result.operations.errors.length > 0)) {
          const errorDetail = {
            type: "token_update_partial_error",
            token: pair.baseToken?.symbol,
            address: pair.baseToken?.address,
            error: result.error || "Operation errors occurred",
            operations: result.operations,
            timestamp: new Date().toISOString(),
          }

          errorDetails.push(errorDetail)
        }
      } catch (error) {
        console.error(
          `❌ [${executionId}] Failed to update token ${pair.baseToken?.symbol} (${pair.baseToken?.address}):`,
          error,
        )
        errors++

        const errorDetail = {
          type: "token_update_error",
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

    // Enhanced error analysis
    if (error.message.includes("Too Many R")) {
      console.error(`🚨 [${executionId}] RATE LIMIT ERROR DETECTED - Source unknown (DexScreener vs Supabase)`)

      const errorDetail = {
        type: "rate_limit",
        message: error instanceof Error ? error.message : "Unknown rate limit error",
        timestamp: new Date().toISOString(),
        tokens: batch,
      }

      errorDetails.push(errorDetail)
    }

    return {
      batch: batch,
      processed: 0,
      errors: batch.length,
      error: error instanceof Error ? error.message : "Unknown error",
      supabaseOps: totalSupabaseOps,
      liquidityUpdates: totalLiquidityUpdates,
      dexscreenerCalls,
      errorDetails,
      tokenResults,
    }
  }

  const batchDuration = Date.now() - batchStartTime
  console.log(
    `✅ [${executionId}] Batch completed in ${batchDuration}ms: ${processed} processed, ${errors} errors, ${totalSupabaseOps} DB ops, ${totalLiquidityUpdates} liquidity updates`,
  )

  return {
    batch: batch,
    processed,
    errors,
    supabaseOps: totalSupabaseOps,
    liquidityUpdates: totalLiquidityUpdates,
    dexscreenerCalls,
    duration: batchDuration,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    tokenResults,
  }
}
