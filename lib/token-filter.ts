import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Initialize Supabase client
// Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment
let supabase: SupabaseClient
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("🔴 CRITICAL: Supabase URL or Service Key is missing in lib/token-filter.ts environment variables.")
    // Depending on your error handling strategy, you might throw an error here
    // or allow supabase to be undefined, and functions will fail gracefully.
    // For now, we'll let it be potentially undefined and check in functions.
  } else {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log("🔵 Supabase client initialized in lib/token-filter.ts")
  }
} catch (error: any) {
  console.error("🔴 CRITICAL: Error initializing Supabase client in lib/token-filter.ts:", error.message, error.stack)
  // throw error; // Optionally re-throw to prevent application startup if Supabase is critical
}

// Default thresholds
const DEFAULT_LIQUIDITY_THRESHOLD = 10000 // $10K
const DEFAULT_VOLUME_THRESHOLD = 1000 // $1K

export interface FilterThresholds {
  liquidity: number
  volume: number
}

/**
 * Get the current liquidity and volume thresholds from the database
 */
export async function getFilterThresholds(): Promise<FilterThresholds> {
  if (!supabase) {
    console.error("Supabase client not initialized in getFilterThresholds. Returning default thresholds.")
    return { liquidity: DEFAULT_LIQUIDITY_THRESHOLD, volume: DEFAULT_VOLUME_THRESHOLD }
  }
  try {
    const { data, error } = await supabase
      .from("liquidity_thresholds") // Assuming volume_threshold_usd is in this table
      .select("threshold_usd, volume_threshold_usd")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error("Error fetching filter thresholds, using defaults:", error)
      return { liquidity: DEFAULT_LIQUIDITY_THRESHOLD, volume: DEFAULT_VOLUME_THRESHOLD }
    }

    return {
      liquidity: data?.threshold_usd || DEFAULT_LIQUIDITY_THRESHOLD,
      volume: data?.volume_threshold_usd || DEFAULT_VOLUME_THRESHOLD,
    }
  } catch (error) {
    console.error("Failed to get filter thresholds, using defaults:", error)
    return { liquidity: DEFAULT_LIQUIDITY_THRESHOLD, volume: DEFAULT_VOLUME_THRESHOLD }
  }
}

/**
 * Check and update a token's liquidity status
 */
export async function checkAndUpdateLiquidityStatus(
  contractAddress: string,
  liquidityUsd: number | null | undefined,
  thresholds: FilterThresholds, // Added thresholds parameter
  executionId?: string,
): Promise<boolean> {
  if (!supabase) {
    console.error(`Supabase client not initialized in checkAndUpdateLiquidityStatus for ${contractAddress}.`)
    return false
  }
  try {
    // const thresholds = await getFilterThresholds() // Removed internal call
    const actualLiquidity = liquidityUsd ?? 0
    const hasLowLiquidity = actualLiquidity < thresholds.liquidity

    const { data: currentToken, error: fetchError } = await supabase
      .from("tokens")
      .select("low_liquidity")
      .eq("contract_address", contractAddress)
      .single()

    if (fetchError && !fetchError.message.includes("No rows found")) {
      console.error(`Error fetching token status for ${contractAddress} (liquidity):`, fetchError)
      return false
    }

    if (currentToken?.low_liquidity !== hasLowLiquidity) {
      const { error: updateError } = await supabase
        .from("tokens")
        .update({ low_liquidity: hasLowLiquidity })
        .eq("contract_address", contractAddress)

      if (updateError) {
        console.error(`Error updating liquidity status for ${contractAddress}:`, updateError)
        return false
      }

      if (executionId) {
        console.log(
          `💧 [${executionId}] Updated liquidity status for ${contractAddress}: ${
            hasLowLiquidity ? "LOW" : "SUFFICIENT"
          } liquidity ($${actualLiquidity.toLocaleString()}) vs threshold $${thresholds.liquidity.toLocaleString()}`,
        )
      }
      return true // Status was changed
    }
    return false // No change needed
  } catch (error) {
    console.error(`Failed to check/update liquidity status for ${contractAddress}:`, error)
    return false
  }
}

/**
 * Check and update a token's 24h volume status
 */
export async function checkAndUpdateVolumeStatus(
  contractAddress: string,
  volume24hUsd: number | null | undefined,
  thresholds: FilterThresholds, // Added thresholds parameter
  executionId?: string,
): Promise<boolean> {
  if (!supabase) {
    console.error(`Supabase client not initialized in checkAndUpdateVolumeStatus for ${contractAddress}.`)
    return false
  }
  try {
    // const thresholds = await getFilterThresholds() // Removed internal call
    const actualVolume = volume24hUsd ?? 0
    const hasLowVolume = actualVolume < thresholds.volume

    const { data: currentToken, error: fetchError } = await supabase
      .from("tokens")
      .select("low_volume")
      .eq("contract_address", contractAddress)
      .single()

    if (fetchError && !fetchError.message.includes("No rows found")) {
      console.error(`Error fetching token status for ${contractAddress} (volume):`, fetchError)
      return false
    }

    if (currentToken?.low_volume !== hasLowVolume) {
      const { error: updateError } = await supabase
        .from("tokens")
        .update({ low_volume: hasLowVolume })
        .eq("contract_address", contractAddress)

      if (updateError) {
        console.error(`Error updating volume status for ${contractAddress}:`, updateError)
        return false
      }

      if (executionId) {
        console.log(
          `📊 [${executionId}] Updated volume status for ${contractAddress}: ${
            hasLowVolume ? "LOW" : "SUFFICIENT"
          } volume ($${actualVolume.toLocaleString()}) vs threshold $${thresholds.volume.toLocaleString()}`,
        )
      }
      return true // Status was changed
    }
    return false // No change needed
  } catch (error) {
    console.error(`Failed to check/update volume status for ${contractAddress}:`, error)
    return false
  }
}

/**
 * Get all active tokens that have sufficient liquidity and volume
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
      .eq("low_liquidity", false)
      .eq("low_volume", false) // Added volume filter

    if (error) {
      console.error("Error fetching active tokens (liquidity & volume):", error)
      return []
    }

    return data.map((token) => token.contract_address)
  } catch (error) {
    console.error("Failed to get active tokens (liquidity & volume):", error)
    return []
  }
}
