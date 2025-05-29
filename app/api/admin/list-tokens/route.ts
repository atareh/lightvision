import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const adminSecret = url.searchParams.get("admin_secret")

    // Verify admin secret
    if (adminSecret !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all tokens with their latest metrics
    const { data: tokens, error } = await supabase.from("tokens").select("*").order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      tokens: tokens || [],
      count: tokens?.length || 0,
    })
  } catch (error) {
    console.error("List tokens error:", error)
    return NextResponse.json({ error: "Failed to list tokens" }, { status: 500 })
  }
}
