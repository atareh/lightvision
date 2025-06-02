import { NextResponse } from "next/server"
import { getFilterThresholds } from "@/lib/token-filter"

export async function GET(request: Request) {
  try {
    const thresholds = await getFilterThresholds()

    return NextResponse.json({
      status: "success",
      data: thresholds,
    })
  } catch (error: any) {
    console.error("Error fetching token filter thresholds:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to fetch token filter thresholds",
      },
      { status: 500 },
    )
  }
}
