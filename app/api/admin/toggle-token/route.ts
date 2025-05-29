import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { contract_address, enabled, admin_secret } = await request.json()

    // Verify admin secret
    if (admin_secret !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!contract_address) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 })
    }

    // Update the token's enabled status
    const { data, error } = await supabase
      .from("tokens")
      .update({
        enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("contract_address", contract_address)
      .select()

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Token ${enabled ? "enabled" : "disabled"} successfully`,
      token: data[0],
    })
  } catch (error) {
    console.error("Toggle token error:", error)
    return NextResponse.json({ error: "Failed to update token" }, { status: 500 })
  }
}
