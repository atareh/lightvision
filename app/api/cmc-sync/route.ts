import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    console.log("🪙 Starting CMC data sync...")

    // Fetch data from CoinMarketCap API
    const cmcResponse = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=HYPE", {
      headers: {
        "X-CMC_PRO_API_KEY": process.env.CMC_PRO_API_KEY!,
        Accept: "application/json",
      },
    })

    if (!cmcResponse.ok) {
      throw new Error(`CMC API error: ${cmcResponse.status} ${cmcResponse.statusText}`)
    }

    const cmcData = await cmcResponse.json()
    const hypeData = cmcData.data.HYPE

    if (!hypeData) {
      throw new Error("HYPE data not found in CMC response")
    }

    // Extract and properly format the data
    const syncData = {
      symbol: "HYPE",
      price: Number.parseFloat(hypeData.quote.USD.price),
      market_cap: Math.round(Number.parseFloat(hypeData.quote.USD.market_cap || 0)),
      percent_change_24h: Number.parseFloat(hypeData.quote.USD.percent_change_24h || 0),
      fully_diluted_market_cap: Math.round(Number.parseFloat(hypeData.quote.USD.fully_diluted_market_cap || 0)),
      volume_24h: Math.round(Number.parseFloat(hypeData.quote.USD.volume_24h || 0)),
      volume_change_24h: Number.parseFloat(hypeData.quote.USD.volume_change_24h || 0),
      synced_at: new Date().toISOString(),
    }

    console.log("📊 Formatted sync data:", syncData)

    // Insert new record into database
    const { data: insertedData, error: insertError } = await supabase.from("cmc_data").insert([syncData]).select()

    if (insertError) {
      throw new Error(`Database insert error: ${insertError.message}`)
    }

    console.log("✅ CMC data synced successfully:", {
      price: syncData.price,
      market_cap: syncData.market_cap,
      volume_24h: syncData.volume_24h,
    })

    return NextResponse.json({
      success: true,
      message: "CMC data synced successfully",
      data: insertedData[0],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ CMC sync failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "CMC sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}
