import { NextResponse } from "next/server"
import { getFilterThresholds, checkAndUpdateLiquidityStatus, checkAndUpdateVolumeStatus } from "@/lib/token-filter"
import { kv } from "@vercel/kv"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", {
      status: 401,
    })
  }

  try {
    const filterThresholds = await getFilterThresholds()

    if (!filterThresholds) {
      console.error("Failed to fetch filter thresholds.")
      return new NextResponse("Failed to fetch filter thresholds", {
        status: 500,
      })
    }

    const { volumeThreshold, liquidityThreshold } = filterThresholds

    // Fetch all token addresses from KV store
    const tokenAddresses = await kv.smembers("token_addresses")

    if (!tokenAddresses || tokenAddresses.length === 0) {
      console.warn("No token addresses found in KV store.")
      return NextResponse.json({ message: "No tokens to process" })
    }

    // Process tokens in batches to avoid exceeding rate limits or execution time limits
    const batchSize = 50 // Adjust batch size as needed
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const tokenBatch = tokenAddresses.slice(i, i + batchSize)

      // Update liquidity status for the current batch of tokens
      await Promise.all(
        tokenBatch.map(async (tokenAddress) => {
          await checkAndUpdateLiquidityStatus(tokenAddress, liquidityThreshold)
          await checkAndUpdateVolumeStatus(tokenAddress, volumeThreshold)
        }),
      )

      console.log(`Processed tokens ${i + 1} to ${Math.min(i + batchSize, tokenAddresses.length)}`)
    }

    return NextResponse.json({ message: "Token statuses updated successfully" })
  } catch (error) {
    console.error("Error during token refresh:", error)
    return new NextResponse("Internal Server Error", {
      status: 500,
    })
  }
}
