import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getLowLiquidityTokensCount, LIQUIDITY_THRESHOLD } from "@/lib/liquidity-filter"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    // Get total tokens
    const { count: totalTokens } = await supabase
      .from("tokens")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)

    // Get active tokens (sufficient liquidity)
    const { count: activeTokens } = await supabase
      .from("tokens")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .eq("low_liquidity", false)

    // Get low liquidity tokens
    const lowLiquidityCount = await getLowLiquidityTokensCount()

    // Get low liquidity tokens with details
    const { data: lowLiquidityTokens } = await supabase
      .from("tokens")
      .select(`
        contract_address,
        symbol,
        name,
        updated_at,
        token_metrics!inner(liquidity_usd, recorded_at)
      `)
      .eq("enabled", true)
      .eq("low_liquidity", true)
      .order("token_metrics.recorded_at", { ascending: false })
      .limit(10)

    return NextResponse.json({
      threshold_usd: LIQUIDITY_THRESHOLD,
      total_tokens: totalTokens || 0,
      active_tokens: activeTokens || 0,
      low_liquidity_tokens: lowLiquidityCount,
      percentage_filtered: totalTokens ? Math.round((lowLiquidityCount / totalTokens) * 100) : 0,
      recent_low_liquidity: lowLiquidityTokens || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Liquidity stats error:", error)
    return NextResponse.json({ error: "Failed to fetch liquidity stats" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action, contract_address } = await request.json()

    if (action === "restore" && contract_address) {
      // Manually restore a token (override low liquidity flag)
      const { error } = await supabase
        .from("tokens")
        .update({
          low_liquidity: false,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_address", contract_address)

      if (error) {
        return NextResponse.json({ error: "Failed to restore token" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Token ${contract_address} restored to active status`,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("❌ Liquidity action error:", error)
    return NextResponse.json({ error: "Failed to process liquidity action" }, { status: 500 })
  }
}
