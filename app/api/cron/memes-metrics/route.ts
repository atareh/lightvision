import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getActiveTokens } from "@/lib/token-filter" // Import the function to get visible tokens

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  return handleMemesMetrics(request, true) // true = require auth for GET (real cron)
}

export async function POST(request: NextRequest) {
  return handleMemesMetrics(request, false) // false = skip auth for POST (manual testing)
}

async function handleMemesMetrics(request: NextRequest, requireAuth: boolean) {
  const executionId = `memes_metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  try {
    // Only verify authorization for GET requests (real cron jobs)
    if (requireAuth) {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      console.log(`📊 [${executionId}] Memes metrics cron job triggered (hourly)`)
    } else {
      console.log(`📊 [${executionId}] Memes metrics manual test triggered`)
    }

    // 1. Get all enabled tokens (current behavior)
    const { data: allEnabledTokens, error: tokensError } = await supabase
      .from("tokens")
      .select(`
        contract_address,
        symbol,
        enabled
      `)
      .eq("enabled", true)

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`)
    }

    if (!allEnabledTokens || allEnabledTokens.length === 0) {
      console.log(`⚠️ [${executionId}] No enabled tokens found`)
      return NextResponse.json({
        success: true,
        message: "No enabled tokens to process",
        execution_id: executionId,
        metrics: null,
      })
    }

    console.log(`📋 [${executionId}] Found ${allEnabledTokens.length} enabled tokens`)

    // 2. Get visible tokens (those that pass filtering criteria)
    const visibleTokenAddresses = await getActiveTokens()
    console.log(`📋 [${executionId}] Found ${visibleTokenAddresses.length} visible tokens`)

    // 3. Get latest metrics for ALL tokens in a single query instead of individual queries
    // This avoids rate limits by making a single efficient query
    const { data: allLatestMetrics, error: metricsError } = await supabase
      .from("token_metrics")
      .select("*")
      .in(
        "contract_address",
        allEnabledTokens.map((t) => t.contract_address),
      )
      .order("recorded_at", { ascending: false })

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`)
    }

    // Process the metrics to get only the latest for each token
    const latestMetricsByToken = new Map()
    for (const metric of allLatestMetrics || []) {
      const existingMetric = latestMetricsByToken.get(metric.contract_address)
      if (!existingMetric || new Date(metric.recorded_at) > new Date(existingMetric.recorded_at)) {
        latestMetricsByToken.set(metric.contract_address, metric)
      }
    }

    // 4. Combine token info with their latest metrics
    const allTokenMetrics = []
    for (const token of allEnabledTokens) {
      const latestMetric = latestMetricsByToken.get(token.contract_address)
      if (latestMetric) {
        allTokenMetrics.push({
          ...token,
          ...latestMetric,
        })
      }
    }

    // 5. Filter for visible tokens
    const visibleTokenMetrics = allTokenMetrics.filter((token) =>
      visibleTokenAddresses.includes(token.contract_address),
    )

    console.log(
      `📊 [${executionId}] Processing metrics for ${allTokenMetrics.length} enabled tokens and ${visibleTokenMetrics.length} visible tokens`,
    )

    // 6. Calculate aggregate metrics for both sets
    const allTokensAggregateMetrics = calculateAggregateMetrics(allTokenMetrics, executionId, "all")
    const visibleTokensAggregateMetrics = calculateAggregateMetrics(visibleTokenMetrics, executionId, "visible")

    // 7. Store in memes_metrics table with both sets of metrics
    const { data: insertedData, error: insertError } = await supabase
      .from("memes_metrics")
      .insert([
        {
          recorded_at: new Date().toISOString(),
          // All tokens metrics (current behavior)
          total_market_cap: allTokensAggregateMetrics.total_market_cap,
          total_volume_24h: allTokensAggregateMetrics.total_volume_24h,
          total_liquidity: allTokensAggregateMetrics.total_liquidity,
          token_count: allTokensAggregateMetrics.token_count,
          avg_price_change_1h: allTokensAggregateMetrics.avg_price_change_1h,
          avg_price_change_24h: allTokensAggregateMetrics.avg_price_change_24h,
          // Visible tokens metrics (new)
          visible_market_cap: visibleTokensAggregateMetrics.total_market_cap,
          visible_volume_24h: visibleTokensAggregateMetrics.total_volume_24h,
          visible_liquidity: visibleTokensAggregateMetrics.total_liquidity,
          visible_token_count: visibleTokensAggregateMetrics.token_count,
          visible_avg_price_change_1h: visibleTokensAggregateMetrics.avg_price_change_1h,
          visible_avg_price_change_24h: visibleTokensAggregateMetrics.avg_price_change_24h,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (insertError) {
      throw new Error(`Failed to insert metrics: ${insertError.message}`)
    }

    const duration = Date.now() - startTime

    console.log(`✅ [${executionId}] Memes metrics stored successfully:`, {
      all_tokens_market_cap: allTokensAggregateMetrics.total_market_cap,
      all_tokens_count: allTokensAggregateMetrics.token_count,
      visible_tokens_market_cap: visibleTokensAggregateMetrics.total_market_cap,
      visible_tokens_count: visibleTokensAggregateMetrics.token_count,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: `Memes metrics calculated and stored successfully`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      all_tokens_metrics: allTokensAggregateMetrics,
      visible_tokens_metrics: visibleTokensAggregateMetrics,
      stored_record: insertedData[0],
      test_mode: !requireAuth,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`❌ [${executionId}] Memes metrics job failed:`, error)

    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        message: "Memes metrics job failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        test_mode: !requireAuth,
      },
      { status: 500 },
    )
  }
}

function calculateAggregateMetrics(tokenMetrics: any[], executionId: string, metricType: "all" | "visible" = "all") {
  console.log(`🧮 [${executionId}] Calculating ${metricType} tokens aggregate metrics...`)

  let totalMarketCap = 0
  let totalVolume24h = 0
  let totalLiquidity = 0
  let tokenCount = 0
  let priceChange1hSum = 0
  let priceChange24hSum = 0
  let priceChange1hCount = 0
  let priceChange24hCount = 0

  for (const token of tokenMetrics) {
    // Market cap
    if (token.market_cap && token.market_cap > 0) {
      totalMarketCap += token.market_cap
      tokenCount++
    }

    // Volume 24h
    if (token.volume_24h && token.volume_24h > 0) {
      totalVolume24h += token.volume_24h
    }

    // Liquidity
    if (token.liquidity_usd && token.liquidity_usd > 0) {
      totalLiquidity += token.liquidity_usd
    }

    // Price changes (for averages)
    if (token.price_change_30m !== null && token.price_change_30m !== undefined) {
      priceChange1hSum += token.price_change_30m
      priceChange1hCount++
    }

    if (token.price_change_24h !== null && token.price_change_24h !== undefined) {
      priceChange24hSum += token.price_change_24h
      priceChange24hCount++
    }
  }

  const avgPriceChange1h = priceChange1hCount > 0 ? priceChange1hSum / priceChange1hCount : null
  const avgPriceChange24h = priceChange24hCount > 0 ? priceChange24hSum / priceChange24hCount : null

  const metrics = {
    total_market_cap: totalMarketCap,
    total_volume_24h: totalVolume24h,
    total_liquidity: totalLiquidity,
    token_count: tokenCount,
    avg_price_change_1h: avgPriceChange1h,
    avg_price_change_24h: avgPriceChange24h,
  }

  console.log(`📊 [${executionId}] Calculated ${metricType} tokens metrics:`, {
    total_market_cap: totalMarketCap,
    token_count: tokenCount,
    avg_price_change_24h: avgPriceChange24h,
    total_volume_24h: totalVolume24h,
    total_liquidity: totalLiquidity,
  })

  return metrics
}
