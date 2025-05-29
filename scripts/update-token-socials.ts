import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// This would be called with the DexScreener data you provided
export async function updateTokenSocials(dexScreenerData: any[]) {
  console.log("🔄 Starting social links update...")

  for (const tokenData of dexScreenerData) {
    try {
      const contractAddress = tokenData.baseToken.address.toLowerCase()

      // Extract social data
      const websites = tokenData.info?.websites || []
      const socials = tokenData.info?.socials || []

      // Update the token in database
      const { error } = await supabase
        .from("tokens")
        .update({
          websites: websites,
          socials: socials,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_address", contractAddress)

      if (error) {
        console.error(`❌ Error updating ${contractAddress}:`, error)
      } else {
        console.log(`✅ Updated social links for ${tokenData.baseToken.symbol}`)
      }
    } catch (error) {
      console.error(`❌ Unexpected error:`, error)
    }
  }

  console.log("✅ Social links update complete!")
}
