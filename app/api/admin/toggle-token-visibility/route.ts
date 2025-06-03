import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("🔴 CRITICAL: Supabase URL or Service Key is missing for toggle-token-visibility.")
  // Potentially throw an error or ensure Supabase client handles this gracefully
}
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

export async function POST(request: Request) {
  try {
    const { contract_address, is_hidden, admin_secret } = await request.json()

    if (admin_secret !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!contract_address || typeof contract_address !== "string") {
      return NextResponse.json({ error: "Contract address is required and must be a string" }, { status: 400 })
    }
    if (typeof is_hidden !== "boolean") {
      return NextResponse.json({ error: "is_hidden flag (boolean) is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("tokens")
      .update({
        is_hidden: is_hidden,
        updated_at: new Date().toISOString(),
      })
      .eq("contract_address", contract_address.toLowerCase()) // Ensure we match lowercase
      .select()
      .single() // Expect a single token to be updated

    if (error) {
      console.error("Toggle token visibility DB error:", error)
      if (error.code === "PGRST116") {
        // PostgREST error for "No rows found"
        return NextResponse.json({ error: "Token not found" }, { status: 404 })
      }
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Token not found or no change made" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Token visibility ${is_hidden ? "hidden" : "shown"} successfully`,
      token: data,
    })
  } catch (error) {
    console.error("Toggle token visibility error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to update token visibility"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
