import { type NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getFilterThresholds, checkAndUpdateLiquidityStatus, checkAndUpdateVolumeStatus } from "@/lib/token-filter"

// Initialize Supabase client
let supabase: SupabaseClient
let supabaseInitializationError: string | null = null
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase URL or Service Key is missing in force-token-filter-check API.")
  }
  supabase = createClient(supabaseUrl, supabaseServiceKey)
  console.log("🔵 Supabase client initialized in force-token-filter-check API.")
} catch (error: any) {
  console.error(
    "🔴 CRITICAL: Error initializing Supabase client in force-token-filter-check API:",
    error.message,
    error.stack,
  )
  supabaseInitializationError = error.message
}

function generateExecutionId(prefix = "exec") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  const routeExecutionId = generateExecutionId("force_filter_check")
  console.log(`➡️ [${routeExecutionId}] ENTERED /api/admin/force-token-filter-check POST handler`)

  if (supabaseInitializationError || !supabase) {
    console.error(
      `[${routeExecutionId}] Supabase client not initialized. Error: ${supabaseInitializationError}. Aborting.`,
    )
    return NextResponse.json(
      {
        success: false,
        message: `Server configuration error: Supabase client not available. Details: ${supabaseInitializationError}`,
        executionId: routeExecutionId,
      },
      { status: 500 },
    )
  }

  try {
    const debugPasswordHeader = request.headers.get("x-debug-password")
    const serverDebugPassword = process.env.DEBUG_PASSWORD

    if (!serverDebugPassword) {
      console.warn(`[${routeExecutionId}] DEBUG_PASSWORD environment variable is not set on the server.`)
      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error: Debug password not set.",
          executionId: routeExecutionId,
        },
        { status: 500 },
      )
    }
    if (debugPasswordHeader !== serverDebugPassword) {
      console.warn(
        `[${routeExecutionId}] Unauthorized attempt to force token filter check. Provided password: '${debugPasswordHeader}'`,
      )
      return NextResponse.json(
        { success: false, message: "Unauthorized.", executionId: routeExecutionId },
        { status: 401 },
      )
    }

    console.log(`[${routeExecutionId}] Authorized. Starting force token filter check on all tokens...`)

    const { data: tokens, error: fetchError } = await supabase
      .from("tokens")
      .select("contract_address, symbol, enabled, low_liquidity, low_volume")
      .order("symbol")

    if (fetchError) {
      console.error(`[${routeExecutionId}] Error fetching tokens:`, fetchError)
      return NextResponse.json(
        { success: false, message: `Failed to fetch tokens: ${fetchError.message}`, executionId: routeExecutionId },
        { status: 500 },
      )
    }

    if (!tokens) {
      console.warn(`[${routeExecutionId}] No tokens found in the database.`)
      return NextResponse.json({
        success: true,
        message: "No tokens found to process.",
        totalTokens: 0,
        executionId: routeExecutionId,
      })
    }

    console.log(`[${routeExecutionId}] Found ${tokens.length} tokens to check.`)

    const thresholds = await getFilterThresholds()
    console.log(
      `[${routeExecutionId}] Using thresholds: Liquidity $${thresholds.liquidity.toLocaleString()}, Volume $${thresholds.volume.toLocaleString()}`,
    )

    const results = {
      totalTokens: tokens.length,
      processedCount: 0,
      liquidityStatusChanges: 0,
      volumeStatusChanges: 0,
      lowLiquidityFinalCount: 0,
      sufficientLiquidityFinalCount: 0,
      lowVolumeFinalCount: 0,
      sufficientVolumeFinalCount: 0,
      errors: [] as { token: string; message: string }[],
    }

    const BATCH_SIZE = 5
    const DELAY_AFTER_EACH_TOKEN_MS = 100 // Short delay after all ops for a token are done
    const DELAY_BETWEEN_BATCHES_MS = 2000
    const DELAY_WITHIN_TOKEN_PROCESSING_MS = 250 // Delay between major DB ops for a single token

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE)
      console.log(
        `[${routeExecutionId}] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          tokens.length / BATCH_SIZE,
        )} (${batch.length} tokens)`,
      )

      for (const token of batch) {
        try {
          console.log(`[${routeExecutionId}] Processing token: ${token.symbol || token.contract_address}`)
          const { data: latestMetrics, error: metricsError } = await supabase
            .from("token_metrics")
            .select("liquidity_usd, volume_24h")
            .eq("contract_address", token.contract_address)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single()

          if (metricsError && !metricsError.message.includes("No rows found")) {
            console.error(
              `[${routeExecutionId}] Error fetching metrics for ${token.symbol} (${token.contract_address}):`,
              metricsError.message,
            )
            results.errors.push({
              token: token.symbol || token.contract_address,
              message: `Metrics fetch error: ${metricsError.message}`,
            })
            await delay(DELAY_AFTER_EACH_TOKEN_MS) // Still delay before next token
            continue
          }
          await delay(DELAY_WITHIN_TOKEN_PROCESSING_MS) // Delay after fetching metrics

          const liquidityUsd = latestMetrics?.liquidity_usd ?? 0
          const volume24hUsd = latestMetrics?.volume_24h ?? 0

          const liquidityChanged = await checkAndUpdateLiquidityStatus(
            token.contract_address,
            liquidityUsd,
            thresholds,
            routeExecutionId,
          )
          if (liquidityChanged) results.liquidityStatusChanges++
          await delay(DELAY_WITHIN_TOKEN_PROCESSING_MS) // Delay after liquidity check

          const volumeChanged = await checkAndUpdateVolumeStatus(
            token.contract_address,
            volume24hUsd,
            thresholds,
            routeExecutionId,
          )
          if (volumeChanged) results.volumeStatusChanges++
          await delay(DELAY_WITHIN_TOKEN_PROCESSING_MS) // Delay after volume check

          const { data: updatedToken, error: refetchError } = await supabase
            .from("tokens")
            .select("low_liquidity, low_volume")
            .eq("contract_address", token.contract_address)
            .single()

          if (refetchError) {
            console.error(
              `[${routeExecutionId}] Error re-fetching token ${token.symbol} for final count:`,
              refetchError.message,
            )
            results.errors.push({
              token: token.symbol || token.contract_address,
              message: `Token re-fetch error: ${refetchError.message}`,
            })
          } else if (updatedToken) {
            if (updatedToken.low_liquidity) results.lowLiquidityFinalCount++
            else results.sufficientLiquidityFinalCount++
            if (updatedToken.low_volume) results.lowVolumeFinalCount++
            else results.sufficientVolumeFinalCount++
          }
          results.processedCount++
        } catch (tokenError: any) {
          console.error(
            `[${routeExecutionId}] Uncaught error processing token ${token.symbol} (${token.contract_address}):`,
            tokenError.message,
            tokenError.stack,
          )
          results.errors.push({ token: token.symbol || token.contract_address, message: tokenError.message })
        }
        console.log(
          `[${routeExecutionId}] Finished token ${token.symbol || token.contract_address}, waiting ${DELAY_AFTER_EACH_TOKEN_MS}ms...`,
        )
        await delay(DELAY_AFTER_EACH_TOKEN_MS)
      } // End of for...of loop for tokens in batch

      if (tokens.length > BATCH_SIZE && i + BATCH_SIZE < tokens.length) {
        console.log(`[${routeExecutionId}] Batch completed, waiting ${DELAY_BETWEEN_BATCHES_MS}ms...`)
        await delay(DELAY_BETWEEN_BATCHES_MS)
      }
    }

    console.log(`[${routeExecutionId}] ✅ Token filter check completed.`)
    return NextResponse.json({
      success: true,
      message: "Token filter check completed.",
      executionId: routeExecutionId,
      ...results,
      errorsCount: results.errors.length,
    })
  } catch (error: any) {
    console.error(
      `[${routeExecutionId}] ❌ Force token filter check failed catastrophically:`,
      error.message,
      error.stack,
    )
    return NextResponse.json(
      {
        success: false,
        message: "Force token filter check failed.",
        error: error.message,
        executionId: routeExecutionId,
      },
      { status: 500 },
    )
  }
}
