import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const LIQUIDITY_THRESHOLD = 10000 // $10K

export async function checkAndUpdateLiquidityStatus(
  contractAddress: string,
  liquidityUsd: number | null,
  executionId: string,
) {
  try {
    const isLowLiquidity = !liquidityUsd || liquidityUsd < LIQUIDITY_THRESHOLD

    console.log(
      `💧 [${executionId}] Liquidity check for ${contractAddress}: $${liquidityUsd?.toLocaleString() || "N/A"} (threshold: $${LIQUIDITY_THRESHOLD.toLocaleString()})`,
    )

    // Update the low_liquidity flag
    const { error } = await supabase
      .from("tokens")
      .update({
        low_liquidity: isLowLiquidity,
        updated_at: new Date().toISOString(),
      })
      .eq("contract_address", contractAddress)

    if (error) {
      console.error(`❌ [${executionId}] Failed to update liquidity status for ${contractAddress}:`, error)
      return false
    }

    if (isLowLiquidity) {
      console.log(
        `🚫 [${executionId}] Token ${contractAddress} marked as low liquidity ($${liquidityUsd?.toLocaleString() || "N/A"})`,
      )
    } else {
      console.log(
        `✅ [${executionId}] Token ${contractAddress} has sufficient liquidity ($${liquidityUsd?.toLocaleString()})`,
      )
    }

    return true
  } catch (error) {
    console.error(`❌ [${executionId}] Error checking liquidity status:`, error)
    return false
  }
}

export async function getActiveLiquidityTokens() {
  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("contract_address")
      .eq("enabled", true)
      .eq("low_liquidity", false) // Only get tokens with sufficient liquidity

    if (error) {
      console.error("❌ Failed to fetch active liquidity tokens:", error)
      return []
    }

    return data?.map((t) => t.contract_address) || []
  } catch (error) {
    console.error("❌ Error fetching active liquidity tokens:", error)
    return []
  }
}

export async function getLowLiquidityTokensCount() {
  try {
    const { count, error } = await supabase
      .from("tokens")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .eq("low_liquidity", true)

    if (error) {
      console.error("❌ Failed to count low liquidity tokens:", error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error("❌ Error counting low liquidity tokens:", error)
    return 0
  }
}
