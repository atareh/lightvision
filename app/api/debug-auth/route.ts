import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    // Use environment variable for debug password
    const debugPassword = process.env.DEBUG_PASSWORD || "hyperdebug2024"

    if (password === debugPassword) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
