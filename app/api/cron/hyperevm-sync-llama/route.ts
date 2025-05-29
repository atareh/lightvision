import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// The same 15 protocol slugs you track
const PROTOCOL_SLUGS = [
  "hypurrfi",
  "hyperyield",
  "looped-hype",
  "kittenswap-finance",
  "growihf",
  "sentiment",
  "hyperpie",
  "hyperlend",
  "keiko-finance",
  "felix",
  "valantis",
  "laminar",
  "upshift",
  "morpho",
  "hyperswap",
]

type RawProtocol = {
  name: string
  chainTvls: Record<string, { tvl: Array<{ date: number; totalLiquidityUSD: number }> }>
}

export async function POST(request: Request) {
  // Verify cron secret if needed
  const authHeader = request.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Starting HyperEVM Llama sync...")

    // 1) Fetch all protocols in parallel
    const protos = await Promise.all(
      PROTOCOL_SLUGS.map((slug) =>
        fetch(`https://api.llama.fi/updatedProtocol/${slug}`)
          .then((r) => r.json() as Promise<RawProtocol>)
          .catch((err) => {
            console.error(`Failed to fetch protocol ${slug}:`, err)
            return null
          }),
      ),
    )

    const validProtos = protos.filter((p) => p !== null) as RawProtocol[]
    console.log(`Successfully fetched ${validProtos.length}/${PROTOCOL_SLUGS.length} protocols`)

    // 2) Build maps for the most recent day only
    const protocolMap = new Map<string, number>()
    let totalForDay = 0
    let latestDay = ""

    // Determine the single most recent "day" across all protocols
    for (const p of validProtos) {
      const chain = p.chainTvls["Hyperliquid L1"] || p.chainTvls["Hyperliquid"]
      if (!chain?.tvl?.length) continue
      const last = chain.tvl[chain.tvl.length - 1]
      const day = new Date(last.date * 1000).toISOString().slice(0, 10)

      // track the latest day string
      if (day > latestDay) latestDay = day
    }

    console.log(`Latest day found: ${latestDay}`)

    // Populate protocolMap & totalForDay for that latestDay
    for (const p of validProtos) {
      const chain = p.chainTvls["Hyperliquid L1"] || p.chainTvls["Hyperliquid"]
      if (!chain?.tvl?.length) continue
      const last = chain.tvl[chain.tvl.length - 1]
      const day = new Date(last.date * 1000).toISOString().slice(0, 10)
      if (day === latestDay) {
        protocolMap.set(p.name, last.totalLiquidityUSD)
        totalForDay += last.totalLiquidityUSD
      }
    }

    // 3) Build upsert records
    const records = Array.from(protocolMap.entries()).map(([protocol_name, daily_tvl]) => ({
      day: latestDay,
      protocol_name,
      daily_tvl,
      total_daily_tvl: totalForDay,
      updated_at: new Date().toISOString(),
    }))

    console.log(`Preparing to upsert ${records.length} records for ${latestDay}`)

    // 4) Upsert into your existing table
    const { error } = await supabase
      .from("hyperevm_protocols")
      .upsert(records, { onConflict: ["protocol_name", "day"] })

    if (error) throw error

    console.log(`Successfully upserted ${records.length} records`)

    return NextResponse.json({
      success: true,
      upserted: records.length,
      day: latestDay,
      totalTVL: totalForDay,
    })
  } catch (err) {
    console.error("hyperevm-sync-llama error", err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
