import { NextResponse } from "next/server"

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

function transformAndComputeAnnualized(rawData: LlamaFeeData) {
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
    }
  })

  return processedData
}

export async function GET() {
  try {
    // Fetch data from DeFiLlama
    const rawData = await fetchLlamaRevenue()

    // Transform and compute annualized revenue
    const processedData = transformAndComputeAnnualized(rawData)

    // Sort by date descending (most recent first)
    const sortedData = processedData.sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())

    return NextResponse.json({
      success: true,
      source: "DeFiLlama Fees API",
      data: sortedData,
      last_updated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching Llama revenue data:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
