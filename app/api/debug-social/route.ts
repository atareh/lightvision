import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    // SECURITY: Require authentication for debug endpoints
    const debugPassword = request.headers.get("x-debug-password")

    if (debugPassword !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get a few tokens with their social data
    const { data: tokens, error } = await supabase
      .from("tokens")
      .select("contract_address, symbol, socials, websites, updated_at")
      .eq("enabled", true)
      .limit(10)

    if (error) {
      throw error
    }

    // Also test fetching from DexScreener for one token to compare
    let dexscreenerSample = null
    if (tokens && tokens.length > 0) {
      const testToken = tokens[0]
      try {
        const response = await fetch(`https://api.dexscreener.com/tokens/v1/hyperevm/${testToken.contract_address}`)
        if (response.ok) {
          const data = await response.json()
          dexscreenerSample = {
            contract_address: testToken.contract_address,
            dexscreener_data: data[0]?.info || null,
          }
        }
      } catch (e) {
        console.error("Failed to fetch DexScreener sample:", e)
      }
    }

    return NextResponse.json({
      success: true,
      database_tokens: tokens,
      dexscreener_sample: dexscreenerSample,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Debug social error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
