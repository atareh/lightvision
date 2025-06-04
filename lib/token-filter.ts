import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL or Service Key is not defined for token-filter.")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface FilterThresholds {
  liquidity: number
  volume: number
}

export async function getActiveTokens(): Promise<
  { contract_address: string; symbol: string | null; name: string | null }[]
> {
  const executionId = `getActiveTokens_${Date.now()}`
  console.log(`[${executionId}] Fetching active (enabled and not hidden) tokens...`)
  const { data, error } = await supabase
    .from("tokens")
    .select("contract_address, symbol, name")
    .eq("enabled", true)
    .eq("is_hidden", false)

  if (error) {
    console.error(`[${executionId}] Error fetching active tokens: ${error.message}`)
    // Depending on how critical this is, you might want to throw the error
    // or return an empty array to prevent the cron from failing entirely.
    // For now, returning empty to allow other parts of a cron to potentially proceed.
    return []
  }

  if (!data) {
    console.log(`[${executionId}] No active tokens found.`)
    return []
  }

  console.log(`[${executionId}] Found ${data.length} active tokens.`)
  return data.map((token) => ({
    contract_address: token.contract_address.toLowerCase(), // Ensure lowercase
    symbol: token.symbol,
    name: token.name,
  }))
}

export async function getFilterThresholds(): Promise<FilterThresholds> {
  const { data, error } = await supabase.from("liquidity_thresholds").select("*").single()

  if (error || !data) {
    console.warn("Failed to fetch filter thresholds, using defaults:", error?.message)
    // Default values if not found or error occurs
    return { liquidity: 10000, volume: 1000 }
  }
  return { liquidity: data.min_liquidity_usd, volume: data.min_volume_usd }
}

export async function checkAndUpdateLiquidityStatus(
  contractAddress: string,
  liquidityThreshold: number,
): Promise<void> {
  const executionId = `liquidity_check_${contractAddress}_${Date.now()}`
  try {
    // console.log(`[${executionId}] Checking liquidity status for ${contractAddress}...`)
    const { data: latestMetrics, error: metricsError } = await supabase
      .from("token_metrics")
      .select("liquidity_usd")
      .eq("contract_address", contractAddress)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single() // Use single to ensure we get one record or null

    const now = new Date().toISOString()

    if (metricsError && metricsError.code !== "PGRST116") {
      // PGRST116: No rows found
      console.error(`[${executionId}] Error fetching latest metrics for ${contractAddress}: ${metricsError.message}`)
      // Still attempt to update updated_at to signify a check was made
      await supabase.from("tokens").update({ updated_at: now }).eq("contract_address", contractAddress)
      return
    }

    const currentLiquidity = latestMetrics?.liquidity_usd ?? 0 // Default to 0 if no metrics
    const newLowLiquidityStatus = currentLiquidity < liquidityThreshold

    const { data: currentToken, error: fetchTokenError } = await supabase
      .from("tokens")
      .select("low_liquidity")
      .eq("contract_address", contractAddress)
      .maybeSingle()

    if (fetchTokenError) {
      console.error(
        `[${executionId}] Error fetching token ${contractAddress} for liquidity check: ${fetchTokenError.message}`,
      )
      // Attempt to update updated_at even if fetching current status fails, as a check was initiated
      await supabase.from("tokens").update({ updated_at: now }).eq("contract_address", contractAddress)
      return
    }

    const updatePayload: { low_liquidity?: boolean; updated_at: string } = { updated_at: now }
    let needsUpdate = true

    if (currentToken) {
      if (currentToken.low_liquidity !== newLowLiquidityStatus) {
        updatePayload.low_liquidity = newLowLiquidityStatus
        // console.log(`[${executionId}] Liquidity status changing for ${contractAddress} to ${newLowLiquidityStatus}. Current liquidity: $${currentLiquidity.toLocaleString()}`);
      } else {
        // Status is the same, only updated_at needs to be set.
        // console.log(`[${executionId}] Liquidity status for ${contractAddress} remains ${newLowLiquidityStatus}. Refreshing updated_at. Current liquidity: $${currentLiquidity.toLocaleString()}`);
      }
    } else {
      // Token not found in 'tokens' table, which is unexpected if this function is called.
      // This might happen if KV store is out of sync with 'tokens' table.
      // For now, we won't insert a new token here, just log.
      console.warn(
        `[${executionId}] Token ${contractAddress} not found in 'tokens' table during liquidity check. Cannot update status.`,
      )
      needsUpdate = false // Don't attempt update if token doesn't exist
    }

    if (needsUpdate) {
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
    // Attempt to update updated_at as a last resort if an unexpected error occurs mid-process
    try {
      await supabase
        .from("tokens")
        .update({ updated_at: new Date().toISOString() })
        .eq("contract_address", contractAddress)
    } catch (finalUpdateError) {
      console.error(`[${executionId}] Failed to make final updated_at touch for ${contractAddress}:`, finalUpdateError)
    }
  }
}

export async function checkAndUpdateVolumeStatus(contractAddress: string, volumeThreshold: number): Promise<void> {
  const executionId = `volume_check_${contractAddress}_${Date.now()}`
  try {
    // console.log(`[${executionId}] Checking volume status for ${contractAddress}...`)
    const { data: latestMetrics, error: metricsError } = await supabase
      .from("token_metrics")
      .select("volume_24h")
      .eq("contract_address", contractAddress)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single()

    const now = new Date().toISOString()

    if (metricsError && metricsError.code !== "PGRST116") {
      console.error(
        `[${executionId}] Error fetching latest metrics for ${contractAddress} (volume): ${metricsError.message}`,
      )
      await supabase.from("tokens").update({ updated_at: now }).eq("contract_address", contractAddress)
      return
    }

    const currentVolume = latestMetrics?.volume_24h ?? 0
    const newLowVolumeStatus = currentVolume < volumeThreshold

    const { data: currentToken, error: fetchTokenError } = await supabase
      .from("tokens")
      .select("low_volume")
      .eq("contract_address", contractAddress)
      .maybeSingle()

    if (fetchTokenError) {
      console.error(
        `[${executionId}] Error fetching token ${contractAddress} for volume check: ${fetchTokenError.message}`,
      )
      await supabase.from("tokens").update({ updated_at: now }).eq("contract_address", contractAddress)
      return
    }

    const updatePayload: { low_volume?: boolean; updated_at: string } = { updated_at: now }
    let needsUpdate = true

    if (currentToken) {
      if (currentToken.low_volume !== newLowVolumeStatus) {
        updatePayload.low_volume = newLowVolumeStatus
        // console.log(`[${executionId}] Volume status changing for ${contractAddress} to ${newLowVolumeStatus}. Current volume: $${currentVolume.toLocaleString()}`);
      } else {
        // console.log(`[${executionId}] Volume status for ${contractAddress} remains ${newLowVolumeStatus}. Refreshing updated_at. Current volume: $${currentVolume.toLocaleString()}`);
      }
    } else {
      console.warn(
        `[${executionId}] Token ${contractAddress} not found in 'tokens' table during volume check. Cannot update status.`,
      )
      needsUpdate = false
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("tokens")
        .update(updatePayload)
        .eq("contract_address", contractAddress)

      if (updateError) {
        console.error(`[${executionId}] Error updating volume status for ${contractAddress}: ${updateError.message}`)
      }
    }
  } catch (error) {
    console.error(
      `[${executionId}] Unexpected error in checkAndUpdateVolumeStatus for ${contractAddress}:`,
      error instanceof Error ? error.message : error,
    )
    try {
      await supabase
        .from("tokens")
        .update({ updated_at: new Date().toISOString() })
        .eq("contract_address", contractAddress)
    } catch (finalUpdateError) {
      console.error(
        `[${executionId}] Failed to make final updated_at touch for ${contractAddress} (volume):`,
        finalUpdateError,
      )
    }
  }
}
