import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Initialize Supabase client once
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables.")
  // In a real script, you might throw an error or process.exit()
  // For v0 scripts, logging the error might be sufficient, or let it fail if supabase is essential.
}
if (!supabaseServiceKey) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.")
}

let supabase: SupabaseClient
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey)
  console.log("Supabase client initialized.")
} else {
  console.error("Supabase client could not be initialized due to missing environment variables.")
  // Fallback or throw error if supabase is critical for the script to run
  // For this script, supabase is critical.
}

export async function updateTokenSocials(dexScreenerData: any[]) {
  if (!supabase) {
    console.error("Supabase client is not initialized. Cannot update token socials.")
    return
  }

  console.log("🔄 Starting social links update...")

  for (const tokenData of dexScreenerData) {
    try {
      if (!tokenData?.baseToken?.address) {
        console.warn(
          `⚠️ Missing baseToken address for an item in dexScreenerData. Skipping. Item: ${JSON.stringify(tokenData)}`,
        )
        continue
      }
      const contractAddress = tokenData.baseToken.address.toLowerCase()
      const tokenSymbol = tokenData.baseToken.symbol || "N/A"

      const websites = tokenData.info?.websites || []
      const socials = tokenData.info?.socials || []

      // Log what we are about to update
      // console.log(`Attempting to update ${tokenSymbol} (${contractAddress}) with websites: ${JSON.stringify(websites)}, socials: ${JSON.stringify(socials)}`);

      const { error } = await supabase
        .from("tokens")
        .update({
          websites: websites,
          socials: socials,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_address", contractAddress)

      if (error) {
        console.error(`❌ Error updating ${tokenSymbol} (${contractAddress}):`, error.message)
      } else {
        console.log(`✅ Updated social links for ${tokenSymbol} (${contractAddress})`)
      }
    } catch (e: any) {
      const symbol = tokenData?.baseToken?.symbol || "unknown token"
      console.error(`❌ Unexpected error processing token ${symbol}:`, e.message, e.stack)
    }
  }

  console.log("✅ Social links update complete!")
}

// Example of how this script might be called if run directly (for local testing)
// This part won't be executed by the v0 "Run Script" button, which typically calls exported functions.
/*
if (require.main === module) {
  (async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables for local testing.");
      process.exit(1);
    }
    // Example DexScreener data structure
    const exampleData = [
      {
        baseToken: { address: "0xYourTokenAddress1", symbol: "TKN1" },
        info: {
          websites: [{ label: "Website", url: "https://example.com" }],
          socials: [{ type: "twitter", url: "https://twitter.com/example" }],
        },
      },
      // Add more token data as needed
    ];
    console.log("Running example updateTokenSocials locally...");
    await updateTokenSocials(exampleData);
  })().catch(err => {
    console.error("Error in local test run:", err);
  });
}
*/
