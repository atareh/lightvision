import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { rateLimit } from "@/lib/rate-limit"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Cron: Missing Supabase URL or Service Role Key")
}

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!)

const limiter = rateLimit({
  uniqueTokenPerInterval: 2,
  interval: 60000,
})

interface LlamaFeeData {
  totalDataChart: [number, number][]
}

async function fetchLlamaRevenue(executionId: string) {
  console.log(`[${executionId}] Cron: Attempting to fetch Llama revenue data.`)
  const response = await fetch("https://api.llama.fi/summary/fees/Hyperliquid")
  console.log(`[${executionId}] Cron: Llama API response status: ${response.status}`)

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(
      `[${executionId}] Cron: Failed to fetch from DeFiLlama API. Status: ${response.status}, Body: ${errorBody}`,
    )
    throw new Error(`Failed to fetch from DeFiLlama API: ${response.status}`)
  }
  const data = (await response.json()) as LlamaFeeData
  console.log(
    `[${executionId}] Cron: Successfully fetched Llama revenue data. Records: ${data.totalDataChart?.length || 0}`,
  )
  return data
}

function transformAndComputeAnnualized(rawData: LlamaFeeData, executionId: string) {
  console.log(`[${executionId}] Cron: Transforming Llama data. Input records: ${rawData.totalDataChart?.length}`)
  if (!rawData.totalDataChart || rawData.totalDataChart.length === 0) {
    console.warn(`[${executionId}] Cron: No data in totalDataChart to transform.`)
    return []
  }

  const data = rawData.totalDataChart.map(([timestamp, revenue]) => {
    const day = new Date(timestamp * 1000).toISOString().slice(0, 10)
    return { day, revenue }
  })

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
  console.log(`[${executionId}] Cron: Transformed data. Output records: ${processedData.length}`)
  return processedData
}

async function upsertToSupabase(rows: any[], executionId: string) {
  if (!rows || rows.length === 0) {
    console.log(`[${executionId}] Cron: No rows to upsert to Supabase.`)
    return { inserted: 0, updated: 0, error: null }
  }

  console.log(`[${executionId}] Cron: Processing ${rows.length} rows for Supabase table 'daily_revenue'.`)

  let inserted = 0
  let updated = 0
  const now = new Date().toISOString()

  // Process each row individually to ensure updated_at is set correctly
  for (const row of rows) {
    // First check if the record exists
    const { data: existingData, error: checkError } = await supabase
      .from("daily_revenue")
      .select("day")
      .eq("day", row.day)
      .maybeSingle()

    if (checkError) {
      console.error(`[${executionId}] Cron: Error checking for existing record: ${checkError.message}`)
      continue
    }

    if (existingData) {
      // Record exists - use UPDATE with explicit updated_at
      const { error: updateError } = await supabase
        .from("daily_revenue")
        .update({
          ...row,
          updated_at: now, // Explicitly set updated_at to now
        })
        .eq("day", row.day)

      if (updateError) {
        console.error(`[${executionId}] Cron: Failed to update record: ${updateError.message}`)
      } else {
        updated++
        console.log(`[${executionId}] Cron: Updated record for day ${row.day} with new updated_at: ${now}`)
      }
    } else {
      // Record doesn't exist - INSERT with both timestamps
      const { error: insertError } = await supabase.from("daily_revenue").insert({
        ...row,
        created_at: now,
        updated_at: now,
      })

      if (insertError) {
        console.error(`[${executionId}] Cron: Failed to insert record: ${insertError.message}`)
      } else {
        inserted++
        console.log(`[${executionId}] Cron: Inserted new record for day ${row.day}`)
      }
    }
  }

  console.log(`[${executionId}] Cron: Successfully processed data. Inserted: ${inserted}, Updated: ${updated}`)
  return { inserted, updated, error: null }
}

export async function GET(req: Request) {
  const executionId = uuidv4()
  console.log(`[${executionId}] Cron: Revenue sync job started.`)

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.ip || "unknown_ip"
    console.log(`[${executionId}] Cron: Applying rate limit for IP: ${clientIp}`)
    try {
      await limiter.check(NextResponse, clientIp, 2)
    } catch (rateLimitError) {
      console.warn(`[${executionId}] Cron: Rate limit exceeded for IP ${clientIp}.`, rateLimitError)
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const authHeader = req.headers.get("authorization")
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn(
        `[${executionId}] Cron: Unauthorized access attempt. Auth header: ${authHeader ? "Present (mismatch)" : "Missing"}`,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Small delay
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log(`[${executionId}] Cron: Authorization successful.`)

    const rawData = await fetchLlamaRevenue(executionId)
    const processedData = transformAndComputeAnnualized(rawData, executionId)

    if (processedData.length === 0) {
      console.warn(`[${executionId}] Cron: No data processed. Skipping database upsert.`)
      return NextResponse.json({
        success: true,
        execution_id: executionId,
        message: "No data to process or upsert.",
        inserted: 0,
        updated: 0,
      })
    }

    const result = await upsertToSupabase(processedData, executionId)
    console.log(
      `[${executionId}] Cron: Revenue sync job completed successfully. Inserted: ${result.inserted}, Updated: ${result.updated}`,
    )
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      inserted: result.inserted,
      updated: result.updated,
    })
  } catch (error: any) {
    console.error(`[${executionId}] Cron: Error in revenue sync job: ${error.message}`, error)
    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        error: "An error occurred during the sync process",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
