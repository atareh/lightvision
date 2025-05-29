import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

export async function POST(req: Request) {
  try {
    // Check for debug password
    const { password } = await req.json()

    if (!password || password !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Generate a unique execution ID
    const executionId = uuidv4()

    // Fetch data from DeFiLlama
    const rawData = await fetchLlamaRevenue()

    // Transform and compute annualized revenue
    const processedData = transformAndComputeAnnualized(rawData, executionId)

    // Upsert to Supabase
    const { data, error } = await supabase.from("daily_revenue").upsert(processedData, {
      onConflict: ["day"],
    })

    if (error) {
      throw new Error(`Failed to upsert to Supabase: ${error.message}`)
    }

    // Get the latest revenue data for display
    const latestData = processedData.sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())[0]

    return NextResponse.json({
      success: true,
      inserted: processedData.length,
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
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
