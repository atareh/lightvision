import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("CRON: hyperevm-sync-llama - Supabase URL or Service Role Key is not defined.")
  // We can't throw here as it's top-level, but functions will fail if they try to use an undefined client
}

// Ensure Supabase client is created only if env vars are present
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null

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
  slug?: string // For logging which slug failed
}

// Ensure this is GET
export async function GET(request: Request) {
  const executionId = `hyperevm-llama-cron-${Date.now()}`
  console.log(`[${executionId}] CRON: hyperevm-sync-llama job started. Method: ${request.method}`)

  // 1. Verify cron secret (if used)
  const authHeader = request.headers.get("authorization")
  if (
    process.env.CRON_SECRET && // Only check if CRON_SECRET is set
    (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== process.env.CRON_SECRET)
  ) {
    console.warn(
      `[${executionId}] CRON: hyperevm-sync-llama - Unauthorized access attempt. Auth header: ${authHeader ? "Present but invalid" : "Missing"}`,
    )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.log(`[${executionId}] CRON: hyperevm-sync-llama - Authorization successful (or not required).`)

  if (!supabase) {
    console.error(
      `[${executionId}] CRON: hyperevm-sync-llama - Supabase client not initialized due to missing env vars. Aborting.`,
    )
    return NextResponse.json({ success: false, error: "Supabase client not initialized" }, { status: 500 })
  }

  try {
    console.log(`[${executionId}] Fetching ${PROTOCOL_SLUGS.length} protocols from DeFiLlama...`)

    // 2. Fetch all protocols in parallel
    const protoPromises = PROTOCOL_SLUGS.map((slug) =>
      fetch(`https://api.llama.fi/updatedProtocol/${slug}`)
        .then(async (r) => {
          if (!r.ok) {
            const errorText = await r.text().catch(() => "Could not read error text")
            console.warn(
              `[${executionId}] Failed to fetch protocol ${slug}. Status: ${r.status}. Response: ${errorText.slice(0, 100)}`,
            )
            return { name: `FAILED_FETCH_${slug}`, chainTvls: {}, slug } as RawProtocol // Return an object indicating failure
          }
          const data = (await r.json()) as RawProtocol
          data.slug = slug // Add slug for easier debugging
          // console.log(`[${executionId}] Successfully fetched data for slug: ${slug}, protocol name: ${data.name}`) // Can be too verbose
          return data
        })
        .catch((err) => {
          console.error(
            `[${executionId}] Network or parsing error fetching protocol ${slug}:`,
            err instanceof Error ? err.message : String(err),
          )
          return { name: `ERROR_FETCH_${slug}`, chainTvls: {}, slug } as RawProtocol // Return an object indicating error
        }),
    )

    const fetchedProtocols = await Promise.all(protoPromises)

    const validProtos = fetchedProtocols.filter(
      (p) => p && p.name && !p.name.startsWith("FAILED_FETCH_") && !p.name.startsWith("ERROR_FETCH_"),
    ) as RawProtocol[]
    const failedCount = PROTOCOL_SLUGS.length - validProtos.length

    console.log(
      `[${executionId}] Fetched ${validProtos.length}/${PROTOCOL_SLUGS.length} protocols successfully. ${failedCount} failed.`,
    )

    if (validProtos.length === 0) {
      console.warn(`[${executionId}] No valid protocols fetched. Aborting sync.`)
      return NextResponse.json({ success: false, message: "No valid protocols fetched from DeFiLlama.", upserted: 0 })
    }

    // 3. Determine the single most recent "day" across all successfully fetched protocols
    let latestDayOverall = ""
    for (const p of validProtos) {
      const chain = p.chainTvls["Hyperliquid L1"] || p.chainTvls["Hyperliquid"]
      if (!chain?.tvl?.length) {
        continue
      }
      const lastTvlEntry = chain.tvl[chain.tvl.length - 1]
      if (lastTvlEntry && lastTvlEntry.date) {
        const day = new Date(lastTvlEntry.date * 1000).toISOString().slice(0, 10)
        if (day > latestDayOverall) {
          latestDayOverall = day
        }
      } else {
        console.warn(`[${executionId}] Last TVL entry for ${p.name} (slug: ${p.slug}) is malformed or missing date.`)
      }
    }

    if (!latestDayOverall) {
      console.warn(`[${executionId}] Could not determine latest day overall from fetched protocols. Aborting.`)
      return NextResponse.json({
        success: false,
        message: "Could not determine latest day from DeFiLlama data.",
        upserted: 0,
      })
    }
    console.log(`[${executionId}] Latest day determined across all protocols: ${latestDayOverall}`)

    // 4. Populate protocolMap & totalForDay for that latestDayOverall
    const protocolMap = new Map<string, number>() // protocol_name -> TVL
    let totalTvlForLatestDay = 0

    for (const p of validProtos) {
      const chain = p.chainTvls["Hyperliquid L1"] || p.chainTvls["Hyperliquid"]
      if (!chain?.tvl?.length) continue

      const lastTvlEntry = chain.tvl[chain.tvl.length - 1]
      if (lastTvlEntry && lastTvlEntry.date) {
        const dayOfLastEntry = new Date(lastTvlEntry.date * 1000).toISOString().slice(0, 10)
        if (dayOfLastEntry === latestDayOverall) {
          const tvl = lastTvlEntry.totalLiquidityUSD
          protocolMap.set(p.name, tvl)
          totalTvlForLatestDay += tvl
        }
      }
    }
    console.log(
      `[${executionId}] Processed ${protocolMap.size} protocols for day ${latestDayOverall}. Total TVL: ${totalTvlForLatestDay}`,
    )

    if (protocolMap.size === 0) {
      console.warn(
        `[${executionId}] No protocols had TVL data for the determined latest day: ${latestDayOverall}. Nothing to upsert.`,
      )
      return NextResponse.json({
        success: true,
        message: `No protocol TVL data found for ${latestDayOverall}.`,
        upserted: 0,
        day: latestDayOverall,
        totalTVL: 0,
      })
    }

    // 5. Build upsert records
    const llamaExecutionId = `LLAMA_SYNC_TVL_${Date.now()}`

    const recordsToUpsert = Array.from(protocolMap.entries()).map(([protocol_name, daily_tvl]) => ({
      day: latestDayOverall,
      protocol_name,
      daily_tvl,
      total_daily_tvl: totalTvlForLatestDay,
      updated_at: new Date().toISOString(),
      execution_id: llamaExecutionId,
      query_id: 0,
    }))

    console.log(`[${executionId}] Preparing to upsert ${recordsToUpsert.length} records for day ${latestDayOverall}.`)

    // 6. Upsert into your existing table
    const { error: upsertError, count: upsertedCount } = await supabase
      .from("hyperevm_protocols")
      .upsert(recordsToUpsert, { onConflict: "day, protocol_name", ignoreDuplicates: false })

    if (upsertError) {
      console.error(`[${executionId}] Supabase upsert error:`, upsertError)
      throw upsertError
    }

    console.log(
      `[${executionId}] CRON: hyperevm-sync-llama - Successfully upserted ${upsertedCount ?? recordsToUpsert.length} records for day ${latestDayOverall}.`,
    )

    return NextResponse.json({
      success: true,
      message: `Successfully synced TVL data for ${latestDayOverall}.`,
      upserted: upsertedCount ?? recordsToUpsert.length,
      day: latestDayOverall,
      totalTVL: totalTvlForLatestDay,
      protocolsProcessed: protocolMap.size,
      executionId: executionId,
      dbExecutionId: llamaExecutionId,
    })
  } catch (err) {
    console.error(
      `[${executionId}] CRON: hyperevm-sync-llama - Unhandled error:`,
      err instanceof Error ? err.message : String(err),
      err, // Log the full error object for more details
    )
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error during TVL sync" },
      { status: 500 },
    )
  }
}
