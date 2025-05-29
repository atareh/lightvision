import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    // Get all enabled tokens with their latest metrics
    const { data: tokens, error: tokensError } = await supabase
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

    if (!tokens || tokens.length === 0) {
      console.log(`⚠️ [${executionId}] No enabled tokens found`)
      return NextResponse.json({
        success: true,
        message: "No enabled tokens to process",
        execution_id: executionId,
        metrics: null,
      })
    }

    console.log(`📋 [${executionId}] Found ${tokens.length} enabled tokens`)

    // Get latest metrics for each token
    const tokenMetrics = []

    for (const token of tokens) {
      const { data: latestMetric, error: metricError } = await supabase
        .from("token_metrics")
        .select("*")
        .eq("contract_address", token.contract_address)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (metricError) {
        console.error(`❌ [${executionId}] Error fetching metrics for ${token.contract_address}:`, metricError)
        continue
      }

      if (latestMetric) {
        tokenMetrics.push({
          ...token,
          ...latestMetric,
        })
      }
    }

    console.log(`📊 [${executionId}] Processing metrics for ${tokenMetrics.length} tokens with data`)

    // Calculate aggregate metrics
    const aggregateMetrics = calculateAggregateMetrics(tokenMetrics, executionId)

    // Store in memes_metrics table
    const { data: insertedData, error: insertError } = await supabase
      .from("memes_metrics")
      .insert([
        {
          recorded_at: new Date().toISOString(),
          total_market_cap: aggregateMetrics.total_market_cap,
          total_volume_24h: aggregateMetrics.total_volume_24h,
          total_liquidity: aggregateMetrics.total_liquidity,
          token_count: aggregateMetrics.token_count,
          avg_price_change_1h: aggregateMetrics.avg_price_change_1h,
          avg_price_change_24h: aggregateMetrics.avg_price_change_24h,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (insertError) {
      throw new Error(`Failed to insert metrics: ${insertError.message}`)
    }

    const duration = Date.now() - startTime

    console.log(`✅ [${executionId}] Memes metrics stored successfully:`, {
      total_market_cap: aggregateMetrics.total_market_cap,
      token_count: aggregateMetrics.token_count,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: `Memes metrics calculated and stored successfully`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      metrics: aggregateMetrics,
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

function calculateAggregateMetrics(tokenMetrics: any[], executionId: string) {
  console.log(`🧮 [${executionId}] Calculating aggregate metrics...`)

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

  console.log(`📊 [${executionId}] Calculated metrics:`, {
    total_market_cap: totalMarketCap,
    token_count: tokenCount,
    avg_price_change_24h: avgPriceChange24h,
    total_volume_24h: totalVolume24h,
    total_liquidity: totalLiquidity,
  })

  return metrics
}
