import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { contract_address, name, symbol, admin_secret } = await request.json()

    // Verify admin secret
    if (admin_secret !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!contract_address) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 })
    }

    // Insert new token (only metadata, metrics will be populated by cron job)
    const { data, error } = await supabase
      .from("tokens")
      .insert([
        {
          id: contract_address,
          contract_address,
          name: name || null,
          symbol: symbol || null,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json({ error: "Token already exists" }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Token added successfully. Metrics will be populated on next refresh cycle (within 5 minutes).",
      token: data[0],
    })
  } catch (error) {
    console.error("Add token error:", error)
    return NextResponse.json({ error: "Failed to add token" }, { status: 500 })
  }
}
