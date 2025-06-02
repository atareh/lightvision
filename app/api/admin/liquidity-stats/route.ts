import { NextResponse } from "next/server"

import { getActiveTokens } from "@/lib/token-filter"

export async function GET() {
  try {
    const activeTokens = await getActiveTokens()
    const activeTokensCount = activeTokens.length

    return NextResponse.json({ activeTokensCount }, { status: 200 })
  } catch (error) {
    console.error("[LIQUIDITY_STATS_GET]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}
