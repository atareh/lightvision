import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  console.log("🔵 Supabase client initialized in lib/token-filter.ts")
} else {
  console.error(
    "🔴 CRITICAL: Supabase URL or Service Role Key is missing in lib/token-filter.ts environment variables.",
  )
  // Depending on your error handling strategy, you might throw an error here
  // or allow supabase to be null, and functions will fail gracefully.
}

export interface FilterThresholds {
  liquidity: number
  volume: number
}

export async function getFilterThresholds(): Promise<FilterThresholds> {
  const defaultThresholds = { liquidity: 10000, volume: 1000 }
  if (!supabase) {
    console.error("Supabase client not initialized in getFilterThresholds. Returning default thresholds.")
    return defaultThresholds
  }
  try {
    const { data, error } = await supabase
      .from("liquidity_thresholds")
      .select("min_liquidity_usd, min_volume_usd") // Ensure these column names are correct
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        console.warn("No filter thresholds found in DB, using defaults.")
      } else {
        console.error("Error fetching filter thresholds, using defaults:", error.message)
      }
      return defaultThresholds
    }

    return {
      liquidity: data?.min_liquidity_usd || defaultThresholds.liquidity,
      volume: data?.min_volume_usd || defaultThresholds.volume,
    }
  } catch (e: any) {
    console.error("Exception fetching filter thresholds:", e.message)
    return defaultThresholds
  }
}

export async function checkAndUpdateLiquidityStatus(
  contractAddress: string,
  liquidityThreshold: number,
): Promise<void> {
  if (!supabase) {
    console.error(`Supabase client not initialized in checkAndUpdateLiquidityStatus for ${contractAddress}.`)
    return
  }
  const executionId = `liquidity_check_${contractAddress}_${Date.now()}`
  try {
    const { data: latestMetrics, error: metricsError } = await supabase
      .from("token_metrics")
      .select("liquidity_usd")
      .eq("contract_address", contractAddress)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()
    const updatePayload: { low_liquidity?: boolean; updated_at: string } = { updated_at: now }
    const needsTokenRecordUpdate = true

    if (metricsError && metricsError.code !== "PGRST116") {
      // PGRST116: No rows found
      console.error(
        `[${executionId}] Error fetching latest liquidity metrics for ${contractAddress}: ${metricsError.message}`,
      )
      // Still attempt to update updated_at if token exists
    } else if (latestMetrics) {
      const currentLiquidity = latestMetrics.liquidity_usd ?? 0
      const newLowLiquidityStatus = currentLiquidity < liquidityThreshold

      const { data: currentToken, error: fetchTokenError } = await supabase
        .from("tokens")
        .select("low_liquidity")
        .eq("contract_address", contractAddress)
        .maybeSingle()

      if (fetchTokenError && fetchTokenError.code !== "PGRST116") {
        console.error(
          `[${executionId}] Error fetching token ${contractAddress} for liquidity check: ${fetchTokenError.message}`,
        )
      } else if (currentToken) {
        if (currentToken.low_liquidity !== newLowLiquidityStatus) {
          updatePayload.low_liquidity = newLowLiquidityStatus
          console.log(
            `[${executionId}] Liquidity status for ${contractAddress} changing to ${newLowLiquidityStatus}. Current liquidity: $${currentLiquidity.toLocaleString()}`,
          )
        } else {
          console.log(
            `[${executionId}] Liquidity status for ${contractAddress} remains ${currentToken.low_liquidity}. Refreshing updated_at. Current liquidity: $${currentLiquidity.toLocaleString()}`,
          )
        }
      } else {
        // Token not found in 'tokens' table
        console.warn(
          `[${executionId}] Token ${contractAddress} not found in 'tokens' table during liquidity check. Cannot update status, only attempting to update if it exists by chance.`,
        )
        // If token doesn't exist, we might not want to proceed with an update unless we are sure it should.
        // For now, we'll let the update attempt proceed, it will fail if the row doesn't exist.
      }
    } else {
      // No metrics found
      console.warn(
        `[${executionId}] No latest liquidity metrics found for ${contractAddress}. Only updating updated_at.`,
      )
      // Potentially set low_liquidity to true if no metrics? For now, just update updated_at.
      // updatePayload.low_liquidity = true; // Example: if no data, assume low liquidity
    }

    if (needsTokenRecordUpdate) {
      const { error: updateError } = await supabase
        .from("tokens")
        .update(updatePayload)
        .eq("contract_address", contractAddress)

      if (updateError) {
        console.error(`[${executionId}] Error updating liquidity status for ${contractAddress}: ${updateError.message}`)
      }
    }
  } catch (error) {
    console.error(
      `[${executionId}] Unexpected error in checkAndUpdateLiquidityStatus for ${contractAddress}:`,
      error instanceof Error ? error.message : error,
    )
    // Attempt to update updated_at as a last resort
    try {
      if (supabase) {
        await supabase
          .from("tokens")
          .update({ updated_at: new Date().toISOString() })
          .eq("contract_address", contractAddress)
      }
    } catch (finalUpdateError) {
      console.error(`[${executionId}] Failed to make final updated_at touch for ${contractAddress}:`, finalUpdateError)
    }
  }
}

export async function checkAndUpdateVolumeStatus(contractAddress: string, volumeThreshold: number): Promise<void> {
  if (!supabase) {
    console.error(`Supabase client not initialized in checkAndUpdateVolumeStatus for ${contractAddress}.`)
    return
  }
  const executionId = `volume_check_${contractAddress}_${Date.now()}`
  try {
    const { data: latestMetrics, error: metricsError } = await supabase
      .from("token_metrics")
      .select("volume_24h")
      .eq("contract_address", contractAddress)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()
    const updatePayload: { low_volume?: boolean; updated_at: string } = { updated_at: now }

    if (metricsError && metricsError.code !== "PGRST116") {
      console.error(
        `[${executionId}] Error fetching latest volume metrics for ${contractAddress}: ${metricsError.message}`,
      )
    } else if (latestMetrics) {
      const currentVolume = latestMetrics.volume_24h ?? 0
      const newLowVolumeStatus = currentVolume < volumeThreshold

      const { data: currentToken, error: fetchTokenError } = await supabase
        .from("tokens")
        .select("low_volume")
        .eq("contract_address", contractAddress)
        .maybeSingle()

      if (fetchTokenError && fetchTokenError.code !== "PGRST116") {
        console.error(
          `[${executionId}] Error fetching token ${contractAddress} for volume check: ${fetchTokenError.message}`,
        )
      } else if (currentToken) {
        if (currentToken.low_volume !== newLowVolumeStatus) {
          updatePayload.low_volume = newLowVolumeStatus
          console.log(
            `[${executionId}] Volume status for ${contractAddress} changing to ${newLowVolumeStatus}. Current volume: $${currentVolume.toLocaleString()}`,
          )
        } else {
          console.log(
            `[${executionId}] Volume status for ${contractAddress} remains ${currentToken.low_volume}. Refreshing updated_at. Current volume: $${currentVolume.toLocaleString()}`,
          )
        }
      } else {
        console.warn(`[${executionId}] Token ${contractAddress} not found in 'tokens' table during volume check.`)
      }
    } else {
      console.warn(`[${executionId}] No latest volume metrics found for ${contractAddress}. Only updating updated_at.`)
      // updatePayload.low_volume = true; // Example: if no data, assume low volume
    }

    const { error: updateError } = await supabase
      .from("tokens")
      .update(updatePayload)
      .eq("contract_address", contractAddress)

    if (updateError) {
      console.error(`[${executionId}] Error updating volume status for ${contractAddress}: ${updateError.message}`)
    }
  } catch (error) {
    console.error(
      `[${executionId}] Unexpected error in checkAndUpdateVolumeStatus for ${contractAddress}:`,
      error instanceof Error ? error.message : error,
    )
    try {
      if (supabase) {
        await supabase
          .from("tokens")
          .update({ updated_at: new Date().toISOString() })
          .eq("contract_address", contractAddress)
      }
    } catch (finalUpdateError) {
      console.error(
        `[${executionId}] Failed to make final updated_at touch for ${contractAddress} (volume):`,
        finalUpdateError,
      )
    }
  }
}

/**
 * Get all active tokens that have sufficient liquidity and volume, and are not hidden.
 */
export async function getActiveTokens(): Promise<string[]> {
  if (!supabase) {
    console.error("Supabase client not initialized in getActiveTokens.")
    return []
  }
  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("contract_address")
      .eq("enabled", true)
      .eq("is_hidden", false) // Ensure hidden tokens are not included
      .eq("low_liquidity", false)
      .eq("low_volume", false)

    if (error) {
      console.error("Error fetching active tokens (liquidity & volume & hidden status):", error.message)
      return []
    }

    return data?.map((token) => token.contract_address) || []
  } catch (error) {
    console.error(
      "Failed to get active tokens (liquidity & volume & hidden status):",
      error instanceof Error ? error.message : error,
    )
    return []
  }
}
