import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getFilterThresholds, type FilterThresholds } from "@/lib/token-filter"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("🔴 CRITICAL: Supabase URL or Service Key is missing for geckoterminal-sync.")
}
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

interface GeckoPoolAttributes {
  address: string
  name?: string
  base_token_price_usd: string
  quote_token_price_usd: string
  market_cap_usd: string | null
  fdv_usd: string | null
  volume_usd: {
    h24: string
  }
  reserve_in_usd: string
  price_change_percentage: {
    m5?: string
    h1?: string
    h24?: string
    m30?: string
  }
  pool_created_at: string
}

interface GeckoPool {
  id: string
  type: "pool"
  attributes: GeckoPoolAttributes
  relationships: {
    base_token: {
      data: {
        id: string
        type: "token"
      }
    }
    quote_token: {
      data: {
        id: string
        type: "token"
      }
    }
    dex: {
      data: {
        id: string
        type: "dex"
      }
    }
  }
}

interface GeckoTokenAttributes {
  address: string
  name: string
  symbol: string
  image_url: string | null
  gt_score?: number | null
  websites?: { label: string; url: string }[]
  socials?: { platform: string; url: string }[]
}

interface GeckoToken {
  id: string
  type: "token"
  attributes: GeckoTokenAttributes
}

interface GeckoResponse {
  data: GeckoPool[]
  included: (GeckoToken | { type: "dex"; id: string; attributes: { name: string } })[]
}

function extractHexAddress(tokenIdFromGecko: string): string {
  if (!tokenIdFromGecko || typeof tokenIdFromGecko !== "string") {
    console.warn(`Invalid tokenIdFromGecko: ${tokenIdFromGecko}. Cannot extract address.`)
    return `invalid_address_${Date.now()}`
  }
  const parts = tokenIdFromGecko.split("_")
  const potentialAddress = parts[parts.length - 1]
  if (potentialAddress && potentialAddress.startsWith("0x") && potentialAddress.length === 42) {
    return potentialAddress.toLowerCase()
  }
  console.warn(`Unexpected token ID format from GeckoTerminal: ${tokenIdFromGecko}. Defaulting to full ID.`)
  if (tokenIdFromGecko.startsWith("0x") && tokenIdFromGecko.length === 42) {
    return tokenIdFromGecko.toLowerCase()
  }
  return tokenIdFromGecko.toLowerCase() // Fallback, though might not be a valid address
}

function findIncludedToken(baseTokenId: string, included: GeckoResponse["included"]): GeckoToken | null {
  const found = included.find((item) => item.type === "token" && item.id === baseTokenId)
  return found as GeckoToken | null
}

function generateFallbackImageUrl(address: string): string {
  return `https://dd.dexscreener.com/ds-data/tokens/hyperevm/${address.toLowerCase()}.png`
}

async function _fetchPageAttempt(page: number, attemptNumber: number, executionId: string): Promise<Response> {
  const url = `https://api.geckoterminal.com/api/v2/networks/hyperevm/trending_pools?include=base_token,dex&page=${page}&duration=1h`
  console.log(`[${executionId}] 🚀 Fetching page ${page}, attempt ${attemptNumber}... URL: ${url}`)
  return fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Hypescreener/1.1 (Vercel Cron; +https://hypescreener.app)",
    },
  })
}

async function fetchPageWithBackoff(page: number, executionId: string): Promise<GeckoResponse | null> {
  try {
    let response = await _fetchPageAttempt(page, 1, executionId)
    let attempt = 1
    const maxAttempts = 3

    while (response.status === 429 && attempt <= maxAttempts) {
      const retryAfterHeader = response.headers.get("Retry-After")
      let waitTimeSeconds = 60
      if (retryAfterHeader) {
        const parsedWaitTime = Number.parseInt(retryAfterHeader, 10)
        if (!isNaN(parsedWaitTime)) {
          waitTimeSeconds = Math.min(parsedWaitTime, 180) // Cap wait time
        }
      }
      console.log(
        `[${executionId}] ⏳ Rate limited (429) on page ${page} (attempt ${attempt}/${maxAttempts}). Waiting ${waitTimeSeconds} seconds...`,
      )
      await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000))
      attempt++
      response = await _fetchPageAttempt(page, attempt, executionId)
    }

    if (response.status === 429) {
      console.log(`[${executionId}] ❌ Still 429 on page ${page} after ${attempt - 1} attempts. Skipping this page.`)
      return null
    }
    if (response.status >= 500) {
      console.log(`[${executionId}] ❌ Server error (${response.status}) on page ${page}. Skipping.`)
      return null
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Failed to read error text")
      console.error(
        `[${executionId}] ❌ HTTP error ${response.status} on page ${page}: ${errorText.slice(0, 500)}. Skipping.`,
      )
      return null
    }
    const responseText = await response.text()
    try {
      return JSON.parse(responseText) as GeckoResponse
    } catch (jsonError: any) {
      console.error(`[${executionId}] ❌ Error parsing JSON for page ${page}:`, jsonError.message)
      console.error(`[${executionId}] 📄 Response text (first 500 chars): ${responseText.slice(0, 500)}`)
      return null
    }
  } catch (error: any) {
    console.error(`[${executionId}] ❌ Network/fetch error for page ${page}:`, error.message, error.stack)
    return null
  }
}

async function isTokenManuallyDisabledOrHidden(
  contractAddressLowerCase: string,
  executionId: string,
): Promise<boolean> {
  if (!supabase) {
    console.error(
      `[${executionId}] Supabase client not initialized in isTokenManuallyDisabledOrHidden for ${contractAddressLowerCase}.`,
    )
    return false // Fail open, assume not disabled/hidden if DB check fails
  }
  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("enabled, is_hidden")
      .eq("contract_address", contractAddressLowerCase)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      // PGRST116: 'Fetched single row when multiple rows were expected' (should not happen with maybeSingle) or 'Exact one row was requested, but zero rows were matched'
      console.warn(`[${executionId}] DB warning checking token ${contractAddressLowerCase} status: ${error.message}`)
    }
    // If token exists and is (enabled === false OR is_hidden === true), consider it "not processable" by this cron for updates.
    // This cron should not re-enable or unhide tokens.
    if (data && (data.enabled === false || data.is_hidden === true)) {
      return true
    }
    return false // Token is not found, or it is enabled and not hidden
  } catch (e: any) {
    console.error(`[${executionId}] Exception checking token ${contractAddressLowerCase} status: ${e.message}`)
    return false // Fail open
  }
}

enum ProcessTokenStatus {
  Inserted = "inserted",
  ExistingRefreshed = "existing_refreshed",
  SkippedManuallyDisabledOrHidden = "skipped_manual_disable_or_hidden",
  Failed = "failed",
}

interface ProcessTokenResult {
  status: ProcessTokenStatus
  contractAddress: string | null
}

async function processTokenRecord(
  pool: GeckoPool,
  includedToken: GeckoToken,
  filterThresholds: FilterThresholds,
  executionId: string,
): Promise<ProcessTokenResult> {
  if (!supabase) {
    console.error(`[${executionId}] Supabase client not initialized in processTokenRecord.`)
    return { status: ProcessTokenStatus.Failed, contractAddress: null }
  }

  const geckoTokenId = includedToken.id
  if (!geckoTokenId || typeof geckoTokenId !== "string") {
    console.warn(
      `[${executionId}] Invalid or missing geckoTokenId from includedToken for pool ${pool.id}. Skipping. GeckoToken: ${JSON.stringify(includedToken)}`,
    )
    return { status: ProcessTokenStatus.Failed, contractAddress: null }
  }

  const contractAddress = extractHexAddress(geckoTokenId)
  if (!contractAddress || !/^0x[a-f0-9]{40}$/.test(contractAddress)) {
    console.warn(
      `[${executionId}] Invalid contract address: "${contractAddress}" from GeckoToken ID: "${geckoTokenId}" for pool ${pool.id}. Skipping.`,
    )
    return { status: ProcessTokenStatus.Failed, contractAddress: null }
  }

  if (await isTokenManuallyDisabledOrHidden(contractAddress, executionId)) {
    console.log(
      `[${executionId}] Skipping manually disabled or hidden token: ${contractAddress} (Gecko ID: ${geckoTokenId})`,
    )
    return { status: ProcessTokenStatus.SkippedManuallyDisabledOrHidden, contractAddress }
  }

  const { data: existingToken, error: fetchError } = await supabase
    .from("tokens")
    .select("id, low_liquidity, low_volume") // Select flags to compare for new tokens
    .eq("contract_address", contractAddress)
    .maybeSingle()

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error(`[${executionId}] Error fetching existing token ${contractAddress}: ${fetchError.message}`)
    return { status: ProcessTokenStatus.Failed, contractAddress }
  }

  const now = new Date().toISOString()

  if (existingToken) {
    // Token already exists. Update its updated_at timestamp.
    console.log(
      `[${executionId}] Token ${contractAddress} (ID: ${existingToken.id}) already exists. Refreshing updated_at.`,
    )
    const { error: updateError } = await supabase
      .from("tokens")
      .update({ updated_at: now })
      .eq("contract_address", contractAddress)

    if (updateError) {
      console.error(
        `[${executionId}] Error updating updated_at for existing token ${contractAddress}: ${updateError.message}`,
      )
      // Don't mark as failed for this, metrics can still be inserted.
    }
    return { status: ProcessTokenStatus.ExistingRefreshed, contractAddress }
  } else {
    // Token is new, insert it.
    const liquidityUsd = pool.attributes.reserve_in_usd ? Number.parseFloat(pool.attributes.reserve_in_usd) : 0
    const volume24h = pool.attributes.volume_usd?.h24 ? Number.parseFloat(pool.attributes.volume_usd.h24) : 0
    const currentLowLiquidity = liquidityUsd < filterThresholds.liquidity
    const currentLowVolume = volume24h < filterThresholds.volume

    const newImageUrl = includedToken.attributes.image_url || generateFallbackImageUrl(contractAddress)
    const newTokenData = {
      id: geckoTokenId,
      contract_address: contractAddress,
      name: includedToken.attributes.name,
      symbol: includedToken.attributes.symbol,
      pair_address: pool.attributes.address,
      pair_created_at: pool.attributes.pool_created_at,
      dex_id: pool.relationships.dex.data.id,
      chain_id: "hyperevm",
      image_url: newImageUrl,
      gecko_image_url: newImageUrl, // Store the one from Gecko if available
      manual_image: false, // New tokens from Gecko are not manual
      websites: includedToken.attributes.websites || [],
      socials: includedToken.attributes.socials || [],
      enabled: true, // New tokens are enabled by default
      is_hidden: false, // New tokens are not hidden by default
      created_at: now,
      updated_at: now,
      low_liquidity: currentLowLiquidity,
      low_volume: currentLowVolume,
    }

    console.log(`[${executionId}] 🌱 Inserting new token: ${contractAddress} (id: ${geckoTokenId})`)
    const { error: insertError } = await supabase.from("tokens").insert(newTokenData)

    if (insertError) {
      console.error(`[${executionId}] Error inserting new token ${contractAddress}: ${insertError.message}`)
      console.error(`[${executionId}] Insert data: ${JSON.stringify(newTokenData)}`)
      if (insertError.message.includes("duplicate key value violates unique constraint")) {
        console.warn(
          `[${executionId}] Race condition? Insert failed for ${contractAddress} due to existing key. Treating as existing_refreshed.`,
        )
        // Attempt to update updated_at as a fallback
        await supabase.from("tokens").update({ updated_at: now }).eq("contract_address", contractAddress)
        return { status: ProcessTokenStatus.ExistingRefreshed, contractAddress }
      }
      return { status: ProcessTokenStatus.Failed, contractAddress }
    }
    return { status: ProcessTokenStatus.Inserted, contractAddress }
  }
}

async function insertTokenMetrics(pool: GeckoPool, contractAddress: string, executionId: string): Promise<boolean> {
  if (!supabase) {
    console.error(`[${executionId}] Supabase client not initialized in insertTokenMetrics.`)
    return false
  }
  // contractAddress is now passed in, already validated and lowercased by processTokenRecord

  const metricsData = {
    contract_address: contractAddress, // Use the passed, validated contractAddress
    price_usd: pool.attributes.base_token_price_usd ? Number.parseFloat(pool.attributes.base_token_price_usd) : null,
    market_cap: pool.attributes.market_cap_usd ? Number.parseFloat(pool.attributes.market_cap_usd) : null,
    fdv: pool.attributes.fdv_usd ? Number.parseFloat(pool.attributes.fdv_usd) : null,
    volume_24h: pool.attributes.volume_usd?.h24 ? Number.parseFloat(pool.attributes.volume_usd.h24) : null,
    liquidity_usd: pool.attributes.reserve_in_usd ? Number.parseFloat(pool.attributes.reserve_in_usd) : null,
    price_change_30m: pool.attributes.price_change_percentage?.m30
      ? Number.parseFloat(pool.attributes.price_change_percentage.m30)
      : null,
    price_change_24h: pool.attributes.price_change_percentage?.h24
      ? Number.parseFloat(pool.attributes.price_change_percentage.h24)
      : null,
    recorded_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("token_metrics").insert(metricsData)

  if (error) {
    console.error(`[${executionId}] Error inserting token metrics for ${contractAddress}: ${error.message}`)
    return false
  }
  return true
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const debugPassword = process.env.DEBUG_PASSWORD
  const debugHeader = request.headers.get("x-debug-password")

  let authorized = false
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true
    console.log(`[gecko-sync] Authorized via CRON_SECRET.`)
  } else if (debugPassword && debugHeader === debugPassword) {
    authorized = true
    console.log(`[gecko-sync] Authorized via DEBUG_PASSWORD header.`)
  }

  if (!authorized) {
    console.warn("Unauthorized access attempt to GeckoTerminal sync cron.")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!supabase) {
    console.error("🔴 CRITICAL: Supabase client not available for GeckoTerminal sync cron.")
    return NextResponse.json({ error: "Internal Server Error: Supabase client not initialized" }, { status: 500 })
  }

  const executionId = `gecko-sync-${Date.now()}`
  console.log(`[${executionId}] 🦎 Starting GeckoTerminal sync...`)

  let totalPagesAttempted = 0
  let successfulPages = 0
  let pagesSkippedOrFailedApi = 0
  let tokensNewlyInserted = 0
  let tokensExistingRefreshed = 0 // New counter
  let tokensSkippedManual = 0 // New counter for manually disabled/hidden
  let tokensSkippedCriteria = 0
  let metricsInsertedCount = 0
  let inactiveTokensDisabledCount = 0 // This remains for the separate cleanup logic

  const INTER_PAGE_DELAY_MS = Number.parseInt(process.env.GECKO_INTER_PAGE_DELAY_MS || "15000", 10)
  const MAX_PAGES_TO_FETCH = Number.parseInt(process.env.GECKO_MAX_PAGES || "3", 10) // Reduced for testing, default was 10
  const MIN_VOLUME_USD = Number.parseFloat(process.env.GECKO_MIN_VOLUME_USD || "1000")
  const MIN_LIQUIDITY_USD = Number.parseFloat(process.env.GECKO_MIN_LIQUIDITY_USD || "5000")

  let filterThresholds: FilterThresholds
  try {
    filterThresholds = await getFilterThresholds()
    console.log(
      `[${executionId}] Using filter thresholds from DB/defaults: Liquidity >= $${filterThresholds.liquidity.toLocaleString()}, Volume >= $${filterThresholds.volume.toLocaleString()}`,
    )
  } catch (e: any) {
    console.error(`[${executionId}] Failed to get filter thresholds: ${e.message}. Using hardcoded defaults.`)
    filterThresholds = { liquidity: 10000, volume: 1000 } // Ensure this matches your intended defaults
  }

  for (let page = 1; page <= MAX_PAGES_TO_FETCH; page++) {
    totalPagesAttempted++
    console.log(`[${executionId}] Processing page ${page}/${MAX_PAGES_TO_FETCH}...`)
    const geckoData = await fetchPageWithBackoff(page, executionId)

    if (geckoData && geckoData.data) {
      successfulPages++
      console.log(
        `[${executionId}] Page ${page}: Fetched ${geckoData.data.length} pools. Included items: ${geckoData.included?.length || 0}.`,
      )

      for (const pool of geckoData.data) {
        if (pool.type !== "pool" || !pool.relationships?.base_token?.data?.id || !pool.attributes?.address) {
          console.warn(
            `[${executionId}] Skipping malformed pool data on page ${page}: ${JSON.stringify(pool).substring(0, 200)}`,
          )
          continue
        }
        const baseTokenInfo = pool.relationships.base_token.data
        const includedToken = findIncludedToken(baseTokenInfo.id, geckoData.included || [])
        if (!includedToken || !includedToken.id) {
          console.warn(
            `[${executionId}] Could not find included token data or token.id for base_token ${baseTokenInfo.id} from pool ${pool.id}. Skipping. IncludedToken: ${JSON.stringify(includedToken)}`,
          )
          continue
        }

        const volumeH24 = pool.attributes.volume_usd?.h24 ? Number.parseFloat(pool.attributes.volume_usd.h24) : 0
        const liquidityUSD = pool.attributes.reserve_in_usd ? Number.parseFloat(pool.attributes.reserve_in_usd) : 0

        if (volumeH24 < MIN_VOLUME_USD || liquidityUSD < MIN_LIQUIDITY_USD) {
          tokensSkippedCriteria++
          // console.log(`[${executionId}] Token ${includedToken.attributes.symbol} (${extractHexAddress(includedToken.id)}) skipped due to low volume/liquidity. Vol: ${volumeH24}, Liq: ${liquidityUSD}`);
          continue
        }

        const processResult = await processTokenRecord(pool, includedToken, filterThresholds, executionId)

        if (
          processResult.contractAddress &&
          (processResult.status === ProcessTokenStatus.Inserted ||
            processResult.status === ProcessTokenStatus.ExistingRefreshed)
        ) {
          // If token was successfully inserted OR its updated_at was refreshed (and not skipped for other reasons), try to insert metrics.
          const metricsSuccess = await insertTokenMetrics(pool, processResult.contractAddress, executionId)
          if (metricsSuccess) metricsInsertedCount++
        }

        switch (processResult.status) {
          case ProcessTokenStatus.Inserted:
            tokensNewlyInserted++
            break
          case ProcessTokenStatus.ExistingRefreshed:
            tokensExistingRefreshed++
            break
          case ProcessTokenStatus.SkippedManuallyDisabledOrHidden:
            tokensSkippedManual++
            break
          case ProcessTokenStatus.Failed:
            // Error already logged in processTokenRecord
            break
        }
      }
    } else {
      pagesSkippedOrFailedApi++
      console.log(`[${executionId}] Page ${page} was not processed or returned no data.`)
    }
    if (page < MAX_PAGES_TO_FETCH && MAX_PAGES_TO_FETCH > 1) {
      // Only delay if there are more pages
      await new Promise((resolve) => setTimeout(resolve, INTER_PAGE_DELAY_MS))
    }
  }

  // Inactive token disabling logic (separate from per-token processing)
  // This part updates `updated_at` for tokens it disables.
  console.log(`[${executionId}] Checking for inactive tokens (not updated in 7 days)...`)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  try {
    const { data: inactiveTokensToDisable, error: inactiveError } = await supabase
      .from("tokens")
      .select("contract_address")
      .eq("enabled", true) // Only consider currently enabled tokens
      .lt("updated_at", sevenDaysAgo)

    if (inactiveError) throw inactiveError

    if (inactiveTokensToDisable && inactiveTokensToDisable.length > 0) {
      const contractAddressesToDisable = inactiveTokensToDisable.map((t) => t.contract_address)
      console.log(
        `[${executionId}] Attempting to disable ${contractAddressesToDisable.length} inactive tokens: ${contractAddressesToDisable.join(", ")}`,
      )
      const { error: disableError } = await supabase
        .from("tokens")
        .update({ enabled: false, updated_at: new Date().toISOString() }) // Set enabled to false and update timestamp
        .in("contract_address", contractAddressesToDisable)
      if (disableError) throw disableError
      inactiveTokensDisabledCount = contractAddressesToDisable.length
      console.log(`[${executionId}] Disabled ${inactiveTokensDisabledCount} inactive tokens.`)
    } else {
      console.log(`[${executionId}] No inactive tokens found to disable.`)
    }
  } catch (e: any) {
    console.error(`[${executionId}] Error during inactive token check/disable: ${e.message}`)
  }

  const summary = {
    execution_id: executionId,
    status: "completed",
    timestamp: new Date().toISOString(),
    pages_attempted: totalPagesAttempted,
    pages_succeeded: successfulPages,
    pages_skipped_or_failed_api: pagesSkippedOrFailedApi,
    tokens_newly_inserted: tokensNewlyInserted,
    tokens_existing_refreshed: tokensExistingRefreshed,
    tokens_skipped_manual_disable_or_hidden: tokensSkippedManual,
    tokens_skipped_low_metrics_api_criteria: tokensSkippedCriteria,
    metrics_records_inserted: metricsInsertedCount,
    inactive_tokens_auto_disabled: inactiveTokensDisabledCount,
  }
  console.log(`[${executionId}] ✅ GeckoTerminal sync summary:`, summary)
  return NextResponse.json({ success: true, summary })
}
