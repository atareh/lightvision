import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  return handleTokenSocialSync(request, true) // true = require auth for GET (real cron)
}

export async function POST(request: NextRequest) {
  return handleTokenSocialSync(request, true) // true = require auth for POST too
}

async function handleTokenSocialSync(request: NextRequest, requireAuth: boolean) {
  const executionId = `social_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  const isManualTest = request.headers.get("x-debug-password") === process.env.DEBUG_PASSWORD

  console.log(`
📱 ========== SOCIAL DATA SYNC STARTED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
🔧 Type: ${isManualTest ? "Manual Test" : "Scheduled Cron"}
🎯 Mode: SOCIAL DATA ONLY (no price metrics)
==============================================
  `)

  try {
    // SECURITY: Always verify authorization
    if (requireAuth) {
      const authHeader = request.headers.get("authorization")
      const debugPassword = request.headers.get("x-debug-password")

      const isValidCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
      const isValidDebug = debugPassword === process.env.DEBUG_PASSWORD

      if (!isValidCron && !isValidDebug) {
        console.error(`❌ [${executionId}] UNAUTHORIZED ACCESS ATTEMPT - Missing or invalid credentials`)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      if (isValidCron) {
        console.log(`📱 [${executionId}] Social data sync cron job triggered (daily)`)
      } else {
        console.log(`📱 [${executionId}] Social data sync manual test triggered (authenticated)`)
      }
    }

    // Get all enabled tokens from database
    console.log(`📋 [${executionId}] Fetching enabled tokens from database...`)
    const dbFetchStart = Date.now()

    const { data: tokens, error: fetchError } = await supabase
      .from("tokens")
      .select("contract_address, socials, websites, image_url, manual_image")
      .eq("enabled", true)

    const dbFetchDuration = Date.now() - dbFetchStart

    if (fetchError) {
      console.error(`❌ [${executionId}] DATABASE ERROR: Failed to fetch tokens: ${fetchError.message}`)
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`)
    }

    console.log(`✅ [${executionId}] Database fetch completed in ${dbFetchDuration}ms`)

    if (!tokens || tokens.length === 0) {
      console.log(`⚠️ [${executionId}] No enabled tokens found`)
      return NextResponse.json({
        success: true,
        message: "No enabled tokens to sync social data",
        execution_id: executionId,
        tokens_processed: 0,
      })
    }

    console.log(`📋 [${executionId}] Found ${tokens.length} enabled tokens for social data sync`)

    // Use smaller batches for social data since we're doing more processing
    const contractAddresses = tokens.map((t) => t.contract_address)
    const batches = chunkArray(contractAddresses, 10)

    console.log(`📦 [${executionId}] Processing ${batches.length} batches (social data only)`)

    let totalProcessed = 0
    let totalUpdated = 0
    let totalSkipped = 0
    let totalErrors = 0
    let supabaseOperations = 0
    let dexscreenerCalls = 0
    const results = []
    const errorDetails = []

    // Process batches with longer delays since this is daily
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchStartTime = Date.now()

      try {
        console.log(`🔄 [${executionId}] Processing batch ${i + 1}/${batches.length} (${batch.length} tokens)`)

        const batchResult = await processSocialBatch(batch, tokens, executionId)
        results.push(batchResult)

        totalProcessed += batchResult.processed
        totalUpdated += batchResult.updated || 0
        totalSkipped += batchResult.skipped || 0
        totalErrors += batchResult.errors
        supabaseOperations += batchResult.supabaseOps || 0
        dexscreenerCalls += batchResult.dexscreenerCalls || 0

        if (batchResult.errorDetails && batchResult.errorDetails.length > 0) {
          errorDetails.push(...batchResult.errorDetails)
        }

        const batchDuration = Date.now() - batchStartTime
        console.log(`✅ [${executionId}] Batch ${i + 1} completed in ${batchDuration}ms`)

        // Longer delay between batches since this is daily (5s)
        if (i < batches.length - 1) {
          console.log(`⏳ [${executionId}] Waiting 5s before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      } catch (error) {
        console.error(`❌ [${executionId}] Batch ${i + 1} failed:`, error)
        totalErrors += batch.length

        const errorDetail = {
          batch: i + 1,
          tokens: batch,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }

        errorDetails.push(errorDetail)
        results.push({
          batch: i + 1,
          processed: 0,
          errors: batch.length,
          error: error instanceof Error ? error.message : "Unknown error",
          errorDetails: [errorDetail],
        })
      }
    }

    const duration = Date.now() - startTime
    const success = totalErrors === 0

    console.log(`
📱 ========== SOCIAL DATA SYNC COMPLETED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
✅ Tokens Processed: ${totalProcessed}
🔄 Tokens Updated: ${totalUpdated}
⏭️ Tokens Skipped: ${totalSkipped}
❌ Errors: ${totalErrors}
🗄️ Database Operations: ${supabaseOperations}
🌐 DexScreener API Calls: ${dexscreenerCalls}
🎯 Mode: SOCIAL DATA ONLY
==============================================
    `)

    return NextResponse.json({
      success,
      execution_id: executionId,
      message: `Social data sync completed: ${totalProcessed} processed, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      tokens_processed: totalProcessed,
      tokens_updated: totalUpdated,
      tokens_skipped: totalSkipped,
      errors: totalErrors,
      supabase_operations: supabaseOperations,
      dexscreener_calls: dexscreenerCalls,
      batches_processed: results.length,
      mode: "social_only",
      results,
      error_details: errorDetails.length > 0 ? errorDetails : undefined,
      test_mode: isManualTest,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error(`
❌ ========== SOCIAL DATA SYNC FAILED ==========
📅 Timestamp: ${new Date().toISOString()}
🆔 Execution ID: ${executionId}
⏱️ Duration: ${duration}ms
💥 Error: ${errorMsg}
===========================================
    `)

    return NextResponse.json(
      {
        success: false,
        execution_id: executionId,
        message: "Social data sync failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        mode: "social_only",
        test_mode: isManualTest,
      },
      { status: 500 },
    )
  }
}

async function processSocialBatch(batch: string[], allTokens: any[], executionId: string) {
  const batchStartTime = Date.now()
  let processed = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  let totalSupabaseOps = 0
  let dexscreenerCalls = 0
  const errorDetails = []
  const tokenResults = []

  try {
    const dexscreenerApiUrl = `https://api.dexscreener.com/tokens/v1/hyperevm/${batch.join(",")}`

    console.log(`🔗 [${executionId}] Calling DexScreener API for social batch: ${batch.length} tokens`)

    const fetchStartTime = Date.now()
    dexscreenerCalls++

    const response = await fetch(dexscreenerApiUrl, {
      headers: {
        "User-Agent": "HyperLiquid-Core/1.0",
        Accept: "application/json",
      },
    })
    const fetchDuration = Date.now() - fetchStartTime

    console.log(`⏱️ [${executionId}] DexScreener API call took ${fetchDuration}ms`)

    if (!response.ok) {
      console.error(`❌ [${executionId}] DexScreener API Error: ${response.status} ${response.statusText}`)
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`📊 [${executionId}] DexScreener response: ${Array.isArray(data) ? data.length : 0} pairs found`)

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`⚠️ [${executionId}] No pairs found for batch`)
      return {
        batch: batch,
        processed: 0,
        updated: 0,
        skipped: batch.length,
        errors: 0,
        supabaseOps: 0,
        dexscreenerCalls,
      }
    }

    // Process each pair in the batch - SOCIAL DATA ONLY
    for (const pair of data) {
      try {
        const dbStartTime = Date.now()
        const existingToken = allTokens.find((t) => t.contract_address === pair.baseToken?.address)

        const result = await updateSocialData(pair, existingToken, executionId)
        const dbDuration = Date.now() - dbStartTime

        console.log(`⏱️ [${executionId}] Social data for ${pair.baseToken?.symbol} took ${dbDuration}ms`)

        totalSupabaseOps += result.supabaseOps
        processed++

        if (result.updated) {
          updated++
        } else {
          skipped++
        }

        tokenResults.push({
          token: pair.baseToken?.symbol,
          address: pair.baseToken?.address,
          duration: dbDuration,
          updated: result.updated,
          changes: result.changes,
        })

        if (result.error) {
          const errorDetail = {
            type: "social_update_error",
            token: pair.baseToken?.symbol,
            address: pair.baseToken?.address,
            error: result.error,
            timestamp: new Date().toISOString(),
          }
          errorDetails.push(errorDetail)
        }
      } catch (error) {
        console.error(`❌ [${executionId}] Failed to update social data for ${pair.baseToken?.symbol}:`, error)
        errors++

        const errorDetail = {
          type: "token_social_error",
          token: pair.baseToken?.symbol,
          address: pair.baseToken?.address,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }
        errorDetails.push(errorDetail)
      }
    }
  } catch (error: any) {
    console.error(`❌ [${executionId}] Social batch failed:`, error)

    return {
      batch: batch,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: batch.length,
      error: error instanceof Error ? error.message : "Unknown error",
      supabaseOps: totalSupabaseOps,
      dexscreenerCalls,
      errorDetails,
      tokenResults,
    }
  }

  const batchDuration = Date.now() - batchStartTime
  console.log(
    `✅ [${executionId}] Social batch completed in ${batchDuration}ms: ${processed} processed, ${updated} updated, ${skipped} skipped`,
  )

  return {
    batch: batch,
    processed,
    updated,
    skipped,
    errors,
    supabaseOps: totalSupabaseOps,
    dexscreenerCalls,
    duration: batchDuration,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    tokenResults,
  }
}

// Function that ONLY updates social data and checks for changes
async function updateSocialData(pair: any, existingToken: any, executionId: string) {
  const baseToken = pair.baseToken
  if (!baseToken?.address) {
    throw new Error("No base token address found")
  }

  console.log(`📱 [${executionId}] Checking social data for ${baseToken.symbol}`)

  let supabaseOps = 0
  const changes = []

  try {
    // Process social data from DexScreener API
    let newSocials = []
    if (pair.info?.socials && Array.isArray(pair.info.socials) && pair.info.socials.length > 0) {
      newSocials = pair.info.socials.map((social: any) => ({
        platform: social.type,
        url: social.url,
      }))
    }

    // Process website data from DexScreener API
    let newWebsites = []
    if (pair.info?.websites && Array.isArray(pair.info.websites) && pair.info.websites.length > 0) {
      newWebsites = pair.info.websites
    }

    // Determine image URL: preserve if manual_image=true, otherwise use API data
    let newImageUrl
    if (existingToken?.manual_image) {
      newImageUrl = existingToken.image_url
      console.log(`🔒 [${executionId}] Preserving manual image for ${baseToken.symbol}`)
    } else {
      newImageUrl = pair.info?.imageUrl || baseToken.image || null
    }

    // Check for changes
    const existingSocials = existingToken?.socials || []
    const existingWebsites = existingToken?.websites || []
    const existingImageUrl = existingToken?.image_url

    const socialsChanged = JSON.stringify(existingSocials) !== JSON.stringify(newSocials)
    const websitesChanged = JSON.stringify(existingWebsites) !== JSON.stringify(newWebsites)
    const imageChanged = !existingToken?.manual_image && existingImageUrl !== newImageUrl

    if (socialsChanged) {
      changes.push(`socials: ${existingSocials.length} -> ${newSocials.length}`)
    }
    if (websitesChanged) {
      changes.push(`websites: ${existingWebsites.length} -> ${newWebsites.length}`)
    }
    if (imageChanged) {
      changes.push(`image: ${existingImageUrl ? "updated" : "added"}`)
    }

    // Only update if there are changes
    if (!socialsChanged && !websitesChanged && !imageChanged) {
      console.log(`⏭️ [${executionId}] No changes detected for ${baseToken.symbol}, skipping update`)
      return {
        supabaseOps,
        updated: false,
        changes: [],
      }
    }

    console.log(`🔄 [${executionId}] Changes detected for ${baseToken.symbol}: ${changes.join(", ")}`)

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (socialsChanged) {
      updateData.socials = newSocials
    }
    if (websitesChanged) {
      updateData.websites = newWebsites
    }
    if (imageChanged) {
      updateData.image_url = newImageUrl
    }

    // Update token metadata
    const { error: updateError } = await supabase
      .from("tokens")
      .update(updateData)
      .eq("contract_address", baseToken.address)

    supabaseOps++

    if (updateError) {
      console.error(`❌ [${executionId}] Social data update failed for ${baseToken.symbol}: ${updateError.message}`)
      return {
        supabaseOps,
        updated: false,
        error: `Update failed: ${updateError.message}`,
        changes,
      }
    }

    console.log(`✅ [${executionId}] Social data updated for ${baseToken.symbol}: ${changes.join(", ")}`)

    return {
      supabaseOps,
      updated: true,
      changes,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ [${executionId}] Social data update failed for ${baseToken.symbol}: ${errorMsg}`)

    return {
      supabaseOps,
      updated: false,
      error: errorMsg,
      changes,
    }
  }
}

// Utility function to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
