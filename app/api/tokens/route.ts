import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL")
}
if (!supabaseServiceRoleKey) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET() {
  try {
    console.log("🔍 Starting tokens API request (slimmed response)...")

    const { data: tokensFromDb, error: tokensError } = await supabase
      .from("tokens")
      .select(
        `
        id, 
        contract_address, 
        name, 
        symbol, 
        image_url, 
        pair_created_at,
        updated_at 
      `,
      ) // Select only necessary fields
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
        message: "No tokens found meeting initial database criteria.",
      })
    }

    const tokensWithMetrics = []

    for (const token of tokensFromDb) {
      try {
        const { data: latestMetrics, error: metricsError } = await supabase
          .from("token_metrics")
          .select(
            `
            price_usd,
            market_cap,
            fdv,
            volume_24h,
            liquidity_usd,
            price_change_30m,
            price_change_24h,
            recorded_at 
          `,
          ) // Select only necessary metrics
          .eq("contract_address", token.contract_address)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (metricsError) {
          console.error(`❌ Error fetching metrics for token ${token.contract_address}:`, metricsError)
        }

        // Combine base token data with its latest metrics
        tokensWithMetrics.push({
          // Fields from 'tokens' table
          id: token.id,
          contract_address: token.contract_address,
          name: token.name,
          symbol: token.symbol,
          image_url: token.image_url,
          pair_created_at: token.pair_created_at,
          token_updated_at: token.updated_at, // Renamed for clarity on client

          // Fields from 'token_metrics' table
          price_usd: latestMetrics?.price_usd || null,
          market_cap: latestMetrics?.market_cap || null,
          fdv: latestMetrics?.fdv || null,
          volume_24h: latestMetrics?.volume_24h || null,
          liquidity_usd: latestMetrics?.liquidity_usd || null,
          price_change_30m: latestMetrics?.price_change_30m || null,
          price_change_24h: latestMetrics?.price_change_24h || null,
          metrics_recorded_at: latestMetrics?.recorded_at || null, // Renamed for clarity
        })
      } catch (error) {
        console.error(`❌ Unexpected error processing token ${token.contract_address}:`, error)
        // Push token with null metrics if an error occurs
        tokensWithMetrics.push({
          id: token.id,
          contract_address: token.contract_address,
          name: token.name,
          symbol: token.symbol,
          image_url: token.image_url,
          pair_created_at: token.pair_created_at,
          token_updated_at: token.updated_at,
          price_usd: null,
          market_cap: null,
          fdv: null,
          volume_24h: null,
          liquidity_usd: null,
          price_change_30m: null,
          price_change_24h: null,
          metrics_recorded_at: null,
        })
      }
    }
    console.log(`✅ Successfully fetched and combined metrics for ${tokensWithMetrics.length} tokens.`)

    const activelyTradedTokens = tokensWithMetrics.filter((token) => {
      return token.price_change_24h !== null
    })
    console.log(`📈 Found ${activelyTradedTokens.length} tokens with non-null 24h price change data.`)

    return formatTokenResponse(activelyTradedTokens)
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
      message: "No tokens found meeting all criteria (including recent 24h trade data).",
    })
  }

  const processedTokens = tokens
    .map((token) => ({
      ...token,
      age_days: token.pair_created_at
        ? Math.floor((Date.now() - new Date(token.pair_created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      // Removed: trade_url, websites, socials
    }))
    .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)) // Ensure sorting is still valid

  // Determine the overall last_updated timestamp for the entire dataset
  // This could be the latest 'token_updated_at' or 'metrics_recorded_at' among all tokens
  const overallLastUpdated = processedTokens.reduce((latest, token) => {
    const tokenUpdateTime = token.token_updated_at ? new Date(token.token_updated_at) : new Date(0)
    const metricsTime = token.metrics_recorded_at ? new Date(token.metrics_recorded_at) : new Date(0)
    const mostRecentForToken = tokenUpdateTime > metricsTime ? tokenUpdateTime : metricsTime
    return mostRecentForToken > latest ? mostRecentForToken : latest
  }, new Date(0))

  return NextResponse.json({
    tokens: processedTokens,
    count: tokens.length,
    last_updated:
      overallLastUpdated.toISOString() === new Date(0).toISOString()
        ? new Date().toISOString()
        : overallLastUpdated.toISOString(),
    // Removed: liquidity_filtered, volume_filtered (can be re-added if needed for frontend flags)
  })
}
