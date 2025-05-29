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
  try {
    const body = await request.json()

    // Simple password check
    if (body.password !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    console.log("Starting manual HyperEVM Llama sync...")

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

    console.log(`Found ${protocolMap.size} protocols for ${latestDay}`)
    console.log(`Total TVL for ${latestDay}: $${totalForDay.toLocaleString()}`)

    // 3) Check what's currently in the database for this day
    const { data: existingRecords, error: selectError } = await supabase
      .from("hyperevm_protocols")
      .select("protocol_name, execution_id")
      .eq("day", latestDay)

    if (selectError) {
      console.error("Error checking existing records:", selectError)
      throw selectError
    }

    console.log(`Found ${existingRecords?.length || 0} existing records for ${latestDay}`)
    if (existingRecords && existingRecords.length > 0) {
      console.log("Existing protocols:", existingRecords.map((r) => r.protocol_name).join(", "))
    }

    // 4) Delete ALL existing records for this day (both Dune and any previous Llama data)
    const { error: deleteError } = await supabase.from("hyperevm_protocols").delete().eq("day", latestDay)

    if (deleteError) {
      console.error("Error deleting existing records:", deleteError)
      throw deleteError
    } else {
      console.log(`Deleted ${existingRecords?.length || 0} existing records for ${latestDay}`)
    }

    // 5) Generate a unique execution ID for this Llama sync
    const llamaExecutionId = `LLAMA_SYNC_${Date.now()}`

    // 6) Build insert records with required fields
    const records = Array.from(protocolMap.entries()).map(([protocol_name, daily_tvl]) => ({
      execution_id: llamaExecutionId, // Required field - use a unique identifier for Llama syncs
      query_id: 0, // Set to 0 for Llama data
      day: latestDay,
      protocol_name,
      daily_tvl,
      total_daily_tvl: totalForDay,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    console.log(`Preparing to insert ${records.length} records for ${latestDay}`)

    // 7) Insert the new records
    const { error: insertError } = await supabase.from("hyperevm_protocols").insert(records)

    if (insertError) {
      console.error("Insert error:", insertError)
      throw insertError
    }

    console.log(`Successfully inserted ${records.length} records with execution_id: ${llamaExecutionId}`)

    return NextResponse.json({
      success: true,
      inserted: records.length,
      deleted: existingRecords?.length || 0,
      day: latestDay,
      totalTVL: totalForDay,
      executionId: llamaExecutionId,
      protocols: Array.from(protocolMap.entries()).map(([name, tvl]) => ({ name, tvl })),
    })
  } catch (err) {
    console.error("Manual hyperevm-sync-llama error", err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
