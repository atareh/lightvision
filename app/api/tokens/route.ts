import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    console.log("🔍 Starting tokens API request...")

    const { data: tokensFromDb, error: tokensError } = await supabase
      .from("tokens")
      .select("*")
      .eq("enabled", true)
      .eq("low_liquidity", false)
      .eq("low_volume", false)
      .eq("is_hidden", false)

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

    console.log(`📋 Found ${tokensFromDb?.length || 0} tokens from DB meeting initial criteria.`)

    if (!tokensFromDb || tokensFromDb.length === 0) {
      return NextResponse.json({
        tokens: [],
        count: 0,
        last_updated: new Date().toISOString(),
        message:
          "No tokens found meeting initial database criteria (enabled, sufficient liquidity/volume, not hidden).",
      })
    }

    const tokensWithMetrics = []

    for (const token of tokensFromDb) {
      try {
        // console.log(`🔍 Fetching metrics for token ${token.contract_address}...`) // Can be noisy

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

        tokensWithMetrics.push({
          ...token,
          price_usd: latestMetrics?.price_usd || null,
          market_cap: latestMetrics?.market_cap || null,
          fdv: latestMetrics?.fdv || null,
          volume_24h: latestMetrics?.volume_24h || null,
          liquidity_usd: latestMetrics?.liquidity_usd || null,
          holder_count: latestMetrics?.holder_count || null,
          price_change_30m: latestMetrics?.price_change_30m || null,
          price_change_24h: latestMetrics?.price_change_24h || null, // This is the key field
          recorded_at: latestMetrics?.recorded_at || null,
        })

        // console.log(`✅ Processed token ${token.symbol || token.contract_address}`) // Can be noisy
      } catch (error) {
        console.error(`❌ Unexpected error processing token ${token.contract_address}:`, error)
        tokensWithMetrics.push({
          ...token, // Still include token info but with null metrics
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
    console.log(`✅ Successfully fetched metrics for ${tokensWithMetrics.length} tokens.`)

    // --- NEW FILTERING STEP ---
    const activelyTradedTokens = tokensWithMetrics.filter((token) => {
      // Keep the token if price_change_24h is not null
      // (meaning it has some 24-hour price change data)
      return token.price_change_24h !== null
    })
    // --- END NEW FILTERING STEP ---

    console.log(`📈 Found ${activelyTradedTokens.length} tokens with non-null 24h price change data (actively traded).`)

    return formatTokenResponse(activelyTradedTokens) // Pass the filtered list
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
  // tokens here will be activelyTradedTokens
  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      tokens: [],
      count: 0,
      last_updated: new Date().toISOString(),
      message:
        "No tokens found meeting all criteria (enabled, sufficient liquidity/volume, not hidden, and recent 24h trade data).", // Updated message
    })
  }

  const processedTokens = tokens
    .map((token) => ({
      ...token,
      age_days: token.pair_created_at
        ? Math.floor((Date.now() - new Date(token.pair_created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      trade_url: token.pair_address ? `https://dexscreener.com/hyperevm/${token.pair_address}` : null,
      websites: token.websites || [],
      socials: token.socials || [],
    }))
    .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))

  const lastUpdated = tokens.reduce((latest, token) => {
    const tokenUpdated = new Date(token.updated_at || token.created_at || 0)
    return tokenUpdated > latest ? tokenUpdated : latest
  }, new Date(0)) // Initial value handles empty array for reduce

  return NextResponse.json({
    tokens: processedTokens,
    count: tokens.length, // This will be the count of activelyTradedTokens
    last_updated: lastUpdated.toISOString(),
    liquidity_filtered: true,
    volume_filtered: true,
    // You could add more flags here if needed, e.g., active_trade_data_filtered: true
  })
}
