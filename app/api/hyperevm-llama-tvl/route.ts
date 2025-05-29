import { NextResponse } from "next/server"

type RawProtocol = {
  name: string
  chainTvls: Record<string, { tvl: Array<{ date: number; totalLiquidityUSD: number }> }>
}

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

export async function GET() {
  try {
    console.log("Starting HyperEVM Llama TVL fetch...")

    // 1. Fetch & parse all protocols in parallel
    const responses = await Promise.all(
      PROTOCOL_SLUGS.map(async (slug) => {
        try {
          console.log(`Fetching protocol: ${slug}`)
          const response = await fetch(`https://api.llama.fi/updatedProtocol/${slug}`)

          if (!response.ok) {
            console.warn(`Failed to fetch ${slug}: ${response.status} ${response.statusText}`)
            return null
          }

          const data = (await response.json()) as RawProtocol
          console.log(`Successfully fetched ${slug}: ${data.name}`)
          return data
        } catch (error) {
          console.error(`Error fetching protocol ${slug}:`, error)
          return null
        }
      }),
    )

    // Filter out failed requests
    const validResponses = responses.filter((proto): proto is RawProtocol => proto !== null)
    console.log(`Successfully fetched ${validResponses.length}/${PROTOCOL_SLUGS.length} protocols`)

    // 2. Build a list of { name, day, ts, tvl }
    const entries: Array<{ name: string; day: string; ts: number; tvl: number }> = []

    for (const proto of validResponses) {
      // Try "Hyperliquid L1" first, then fallback to "Hyperliquid"
      const chain = proto.chainTvls["Hyperliquid L1"] || proto.chainTvls["Hyperliquid"]

      if (!chain || !Array.isArray(chain.tvl)) {
        console.warn(`No Hyperliquid chain data found for protocol: ${proto.name}`)
        continue
      }

      console.log(`Processing ${chain.tvl.length} TVL entries for ${proto.name}`)

      for (const point of chain.tvl) {
        if (!point.date || typeof point.totalLiquidityUSD !== "number") {
          continue
        }

        const date = new Date(point.date * 1_000)
        const day = date.toISOString().slice(0, 10) // YYYY-MM-DD

        entries.push({
          name: proto.name,
          day,
          ts: point.date,
          tvl: point.totalLiquidityUSD ?? 0,
        })
      }
    }

    console.log(`Total entries collected: ${entries.length}`)

    // 3. For each (name, day), keep only the entry with max ts
    const latestByProtocolDay = new Map<string, { name: string; day: string; tvl: number; ts: number }>()

    for (const e of entries) {
      const key = `${e.name}|${e.day}`
      const existing = latestByProtocolDay.get(key)

      if (!existing || e.ts > existing.ts) {
        latestByProtocolDay.set(key, {
          name: e.name,
          day: e.day,
          tvl: e.tvl,
          ts: e.ts,
        })
      }
    }

    const deduped = Array.from(latestByProtocolDay.values())
    console.log(`Deduped entries: ${deduped.length}`)

    // 4. Sum per‐protocol and global totals per day
    const perProtocol = new Map<string, Map<string, number>>() // day → (name→tvl)
    const totalByDay = new Map<string, number>()

    for (const { name, day, tvl } of deduped) {
      if (!perProtocol.has(day)) {
        perProtocol.set(day, new Map())
      }
      perProtocol.get(day)!.set(name, tvl)

      totalByDay.set(day, (totalByDay.get(day) || 0) + tvl)
    }

    console.log(`Days with data: ${totalByDay.size}`)

    // 5. Pick the 3 most recent days
    const recentDays = Array.from(totalByDay.keys())
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3)

    console.log(`Recent days: ${recentDays.join(", ")}`)

    // 6. Build the payload
    const result = recentDays.map((day) => ({
      day,
      totalDailyTvl: totalByDay.get(day)!,
      protocols: Array.from(perProtocol.get(day)!.entries())
        .map(([name, dailyTvl]) => ({ name, dailyTvl }))
        .sort((a, b) => b.dailyTvl - a.dailyTvl),
    }))

    console.log("HyperEVM Llama TVL fetch completed successfully")

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        totalProtocolsFetched: validResponses.length,
        totalProtocolsAttempted: PROTOCOL_SLUGS.length,
        totalEntries: entries.length,
        dedupedEntries: deduped.length,
        daysWithData: totalByDay.size,
        lastUpdated: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error("Error in HyperEVM Llama TVL sync:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
