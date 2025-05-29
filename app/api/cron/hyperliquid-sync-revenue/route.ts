import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { rateLimit } from "@/lib/rate-limit" // Assuming you have this utility

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Create a rate limiter that allows 2 requests per minute
const limiter = rateLimit({
  uniqueTokenPerInterval: 2, // Max 2 unique requests per interval
  interval: 60000, // 1 minute
})

interface LlamaFeeData {
  totalDataChartBreakdown: [number, { hyperliquid?: { [key: string]: number } }][]
}

async function fetchLlamaRevenue() {
  const response = await fetch("https://api.llama.fi/summary/fees/Hyperliquid")

  if (!response.ok) {
    throw new Error(`Failed to fetch from DeFiLlama API: ${response.status}`)
  }

  return (await response.json()) as LlamaFeeData
}

function transformAndComputeAnnualized(rawData: LlamaFeeData, executionId: string) {
  // Process the data
  const data = rawData.totalDataChartBreakdown.map(([timestamp, value]) => {
    const day = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const revenue = value?.hyperliquid?.["Hyperliquid Spot Orderbook"] || 0

    return {
      day,
      revenue,
    }
  })

  // Compute 7-day moving average and annualized revenue
  const processedData = data.map((entry, idx, all) => {
    const window = all.slice(Math.max(0, idx - 6), idx + 1)
    const sum = window.reduce((acc, d) => acc + d.revenue, 0)
    const avg = window.length === 7 ? sum / 7 : null

    return {
      day: entry.day,
      revenue: entry.revenue,
      annualized_revenue: avg ? Math.round(avg * 365) : null,
      execution_id: executionId,
      query_id: 999999, // Using a high number to distinguish Llama data from Dune queries
    }
  })

  return processedData
}

async function upsertToSupabase(rows: any[]) {
  const { data, error } = await supabase.from("daily_revenue").upsert(rows, {
    onConflict: ["day"],
  })

  if (error) {
    throw new Error(`Failed to upsert to Supabase: ${error.message}`)
  }

  return { inserted: rows.length }
}

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    try {
      await limiter.check(NextResponse, req.ip || "anonymous", 2) // 2 requests per minute
    } catch {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    // Verify cron secret if provided in headers
    const authHeader = req.headers.get("authorization")
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("Unauthorized access attempt to cron endpoint")
      // Add a small delay to slow down brute force attempts
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Generate a unique execution ID
    const executionId = uuidv4()

    // Fetch data from DeFiLlama
    const rawData = await fetchLlamaRevenue()

    // Transform and compute annualized revenue
    const processedData = transformAndComputeAnnualized(rawData, executionId)

    // Upsert to Supabase
    const result = await upsertToSupabase(processedData)

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      ...result,
    })
  } catch (error) {
    console.error("Error in revenue sync:", error)
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during the sync process", // Don't expose detailed error messages
      },
      { status: 500 },
    )
  }
}
