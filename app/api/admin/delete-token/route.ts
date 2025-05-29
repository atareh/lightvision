import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { contract_address, admin_secret } = await request.json()

    // Verify admin secret
    if (admin_secret !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!contract_address) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 })
    }

    // First delete all token metrics for this token
    const { error: metricsError } = await supabase
      .from("token_metrics")
      .delete()
      .eq("contract_address", contract_address)

    if (metricsError) {
      console.error("Error deleting token metrics:", metricsError)
      // Continue anyway - we still want to delete the token
    }

    // Then delete the token itself
    const { data, error } = await supabase.from("tokens").delete().eq("contract_address", contract_address).select()

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Token and all associated data deleted successfully",
      deleted_token: data[0],
    })
  } catch (error) {
    console.error("Delete token error:", error)
    return NextResponse.json({ error: "Failed to delete token" }, { status: 500 })
  }
}
