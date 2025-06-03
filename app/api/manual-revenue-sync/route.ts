import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { rateLimit } from "@/lib/rate-limit"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Create a rate limiter that allows 5 attempts per minute
const limiter = rateLimit({
  uniqueTokenPerInterval: 5, // Max 5 unique attempts per interval
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

async function upsertToSupabase(rows: any[], executionId: string) {
  if (!rows || rows.length === 0) {
    return { inserted: 0, updated: 0, error: null }
  }

  const now = new Date().toISOString()

  // Add only updated_at timestamp to all rows (created_at will be set automatically on first insert)
  const rowsWithTimestamps = rows.map((row) => ({
    ...row,
    updated_at: now,
  }))

  // Use upsert but with merge to ensure updated_at is always set
  const { error } = await supabase.from("daily_revenue").upsert(rowsWithTimestamps, {
    onConflict: "day",
    ignoreDuplicates: false,
  })

  if (error) {
    console.error("Manual sync: Failed to upsert records:", error.message)
    return { inserted: 0, updated: 0, error: error.message }
  }

  console.log(`Manual sync: Successfully upserted ${rows.length} records with updated_at: ${now}`)
  return { inserted: 0, updated: rows.length, error: null }
}

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    try {
      await limiter.check(NextResponse, req.ip || "anonymous", 5) // 5 attempts per minute
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Too many attempts, please try again later",
        },
        { status: 429 },
      )
    }

    // Check for debug password
    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 })
    }

    // Use direct comparison since we don't have a hashed password stored
    // In a production environment, you should use hashed passwords
    if (password !== process.env.DEBUG_PASSWORD) {
      console.warn("Invalid password attempt")
      // Add a small delay to slow down brute force attempts
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      )
    }

    // Generate a unique execution ID
    const executionId = uuidv4()

    // Fetch data from DeFiLlama
    const rawData = await fetchLlamaRevenue()

    // Transform and compute annualized revenue
    const processedData = transformAndComputeAnnualized(rawData, executionId)

    // Upsert to Supabase with proper updated_at handling
    const result = await upsertToSupabase(processedData, executionId)

    if (result.error) {
      throw new Error(`Failed to upsert to Supabase: ${result.error}`)
    }

    // Get the latest revenue data for display
    const latestData = processedData.sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())[0]

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      latest_day: latestData.day,
      latest_revenue: latestData.revenue,
      latest_annualized: latestData.annualized_revenue,
      execution_id: executionId,
    })
  } catch (error) {
    console.error("Error in manual revenue sync:", error)
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during the sync process", // Don't expose detailed error messages
      },
      { status: 500 },
    )
  }
}
