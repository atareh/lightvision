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
  totalDataChart: [number, number][]
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
  const data = rawData.totalDataChart.map(([timestamp, revenue]) => {
    const day = new Date(timestamp * 1000).toISOString().slice(0, 10)
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
      query_id: 999999,
    }
  })

  return processedData
}

async function upsertToSupabase(rows: any[], executionId: string) {
  if (!rows || rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, error: null }
  }

  console.log(`Manual sync: Processing ${rows.length} rows for selective upsert`)

  let inserted = 0
  let updated = 0
  let skipped = 0
  const now = new Date().toISOString()

  // Get the latest date we have in the database
  const { data: latestRecord, error: latestError } = await supabase
    .from("daily_revenue")
    .select("day, revenue, annualized_revenue")
    .order("day", { ascending: false })
    .limit(1)
    .single()

  if (latestError && latestError.code !== "PGRST116") {
    // PGRST116 = no rows found
    console.error("Manual sync: Error fetching latest record:", latestError.message)
    return { inserted: 0, updated: 0, skipped: 0, error: latestError.message }
  }

  const latestDay = latestRecord?.day || "1970-01-01"
  console.log(`Manual sync: Latest day in database: ${latestDay}`)

  // Filter to only process new days or days with changed values
  const rowsToProcess = []

  for (const row of rows) {
    if (row.day > latestDay) {
      // New day - always insert
      rowsToProcess.push({ ...row, action: "insert" })
    } else if (row.day === latestDay) {
      // Same day - check if values changed
      const revenueChanged = Math.abs((latestRecord.revenue || 0) - row.revenue) > 0.01
      const annualizedChanged = Math.abs((latestRecord.annualized_revenue || 0) - (row.annualized_revenue || 0)) > 1

      if (revenueChanged || annualizedChanged) {
        rowsToProcess.push({ ...row, action: "update" })
        console.log(
          `Manual sync: Values changed for ${row.day} - Revenue: ${latestRecord.revenue} -> ${row.revenue}, Annualized: ${latestRecord.annualized_revenue} -> ${row.annualized_revenue}`,
        )
      } else {
        skipped++
        console.log(`Manual sync: No changes for ${row.day}, skipping`)
      }
    } else {
      // Older day - skip unless we want to backfill
      skipped++
    }
  }

  console.log(
    `Manual sync: Will process ${rowsToProcess.length} rows (${rowsToProcess.filter((r) => r.action === "insert").length} inserts, ${rowsToProcess.filter((r) => r.action === "update").length} updates), skipping ${skipped}`,
  )

  // Process only the rows that need changes
  for (const row of rowsToProcess) {
    const { action, ...rowData } = row

    if (action === "insert") {
      const { error: insertError } = await supabase.from("daily_revenue").insert({
        ...rowData,
        created_at: now,
        updated_at: now,
      })

      if (insertError) {
        console.error(`Manual sync: Failed to insert ${rowData.day}:`, insertError.message)
      } else {
        inserted++
        console.log(`Manual sync: Inserted new record for ${rowData.day}`)
      }
    } else if (action === "update") {
      const { error: updateError } = await supabase
        .from("daily_revenue")
        .update({
          ...rowData,
          updated_at: now,
        })
        .eq("day", rowData.day)

      if (updateError) {
        console.error(`Manual sync: Failed to update ${rowData.day}:`, updateError.message)
      } else {
        updated++
        console.log(`Manual sync: Updated record for ${rowData.day}`)
      }
    }
  }

  console.log(`Manual sync: Completed - Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`)
  return { inserted, updated, skipped, error: null }
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
      skipped: result.skipped,
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
