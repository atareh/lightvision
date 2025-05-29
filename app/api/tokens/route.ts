import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    console.log("🔍 Starting tokens API request...")

    // Get all enabled tokens
    const { data: tokens, error: tokensError } = await supabase.from("tokens").select("*").eq("enabled", true)

    if (tokensError) {
      console.error("❌ Tokens query error:", tokensError)
      return NextResponse.json(
        {
          error: "Failed to fetch tokens from database",
          details: tokensError.message,
          code: tokensError.code,
        },
        { status: 500 },
      )
    }

    console.log(`📋 Found ${tokens?.length || 0} enabled tokens`)

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        tokens: [],
        count: 0,
        last_updated: new Date().toISOString(),
        message: "No tokens found. Add some tokens first.",
      })
    }

    // Get latest metrics for each token
    const tokensWithMetrics = []

    for (const token of tokens) {
      try {
        console.log(`🔍 Fetching metrics for token ${token.contract_address}...`)

        // Get the most recent metrics for this token from our database
        const { data: latestMetrics, error: metricsError } = await supabase
          .from("token_metrics")
          .select("*")
          .eq("contract_address", token.contract_address)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (metricsError) {
          console.error(`❌ Error fetching metrics for token ${token.contract_address}:`, metricsError)
        }

        // Combine token metadata with latest metrics from our database
        tokensWithMetrics.push({
          ...token,
          // Add metrics fields (will be null if no metrics exist yet)
          price_usd: latestMetrics?.price_usd || null,
          market_cap: latestMetrics?.market_cap || null,
          fdv: latestMetrics?.fdv || null,
          volume_24h: latestMetrics?.volume_24h || null,
          liquidity_usd: latestMetrics?.liquidity_usd || null,
          holder_count: latestMetrics?.holder_count || null,
          price_change_30m: latestMetrics?.price_change_30m || null,
          price_change_24h: latestMetrics?.price_change_24h || null,
          recorded_at: latestMetrics?.recorded_at || null,
        })

        console.log(`✅ Processed token ${token.symbol || token.contract_address}`)
      } catch (error) {
        console.error(`❌ Unexpected error processing token ${token.contract_address}:`, error)

        // Still include the token but without metrics
        tokensWithMetrics.push({
          ...token,
          price_usd: null,
          market_cap: null,
          fdv: null,
          volume_24h: null,
          liquidity_usd: null,
          holder_count: null,
          price_change_30m: null,
          price_change_24h: null,
          recorded_at: null,
        })
      }
    }

    console.log(`✅ Successfully processed ${tokensWithMetrics.length} tokens`)
    return formatTokenResponse(tokensWithMetrics)
  } catch (error) {
    console.error("❌ Unexpected API error:", error)

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function formatTokenResponse(tokens: any[]) {
  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      tokens: [],
      count: 0,
      last_updated: new Date().toISOString(),
      message: "No tokens found. Add some tokens first.",
    })
  }

  // Calculate additional metrics and sort by market cap
  const processedTokens = tokens
    .map((token) => ({
      ...token,
      age_days: token.pair_created_at
        ? Math.floor((Date.now() - new Date(token.pair_created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      trade_url: token.pair_address ? `https://dexscreener.com/hyperevm/${token.pair_address}` : null,
      // Include social data (already stored as JSONB in database)
      websites: token.websites || [],
      socials: token.socials || [],
    }))
    .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)) // Sort by market cap descending

  const lastUpdated = tokens.reduce((latest, token) => {
    const tokenUpdated = new Date(token.recorded_at || token.updated_at || 0)
    return tokenUpdated > latest ? tokenUpdated : latest
  }, new Date(0))

  return NextResponse.json({
    tokens: processedTokens,
    count: tokens.length,
    last_updated: lastUpdated.toISOString(),
  })
}
