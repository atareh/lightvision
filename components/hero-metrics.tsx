"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useCryptoData } from "@/hooks/use-crypto-data"
import { useDuneData } from "@/hooks/use-dune-data"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { useRevenueData } from "@/hooks/use-revenue-data"

export default function HeroMetrics() {
  const { data: cryptoData, loading: cryptoLoading, error: cryptoError } = useCryptoData()
  const { data: duneData, loading: duneLoading, error: duneError } = useDuneData()
  const { data: hyperEVMData, loading: hyperEVMLoading, error: hyperEVMError } = useHyperEVMData()
  const { data: revenueData, loading: revenueLoading, error: revenueError } = useRevenueData()

  // Add these debug logs after the hook calls
  console.log("Dune Data Debug:", {
    current_tvl: duneData?.tvl,
    previous_tvl: duneData?.previous_day_tvl,
    tvl_difference: duneData?.tvl && duneData?.previous_day_tvl ? duneData.tvl - duneData.previous_day_tvl : "N/A",
    current_wallets: duneData?.total_wallets,
    previous_wallets: duneData?.previous_day_wallets,
    wallet_difference:
      duneData?.total_wallets && duneData?.previous_day_wallets
        ? duneData.total_wallets - duneData.previous_day_wallets
        : "N/A",
  })

  // Helper function to format TVL in billions/millions with specific decimal rules
  const formatTVL = (tvl: number | null | undefined): string => {
    if (!tvl || tvl === 0) return "TO DO"

    const absTvl = Math.abs(tvl)

    if (absTvl >= 1e9) {
      // Billions: always X.XX format
      return `$${(tvl / 1e9).toFixed(2)}B`
    } else if (absTvl >= 100e6) {
      // 100M to 999M: $XXX format (no decimals)
      return `$${Math.round(tvl / 1e6)}M`
    } else if (absTvl >= 10e6) {
      // 10M to 99M: $XX.X format
      return `$${(tvl / 1e6).toFixed(1)}M`
    } else if (absTvl >= 1e6) {
      // 1M to 9M: X.XX format
      return `$${(tvl / 1e6).toFixed(2)}M`
    } else if (absTvl >= 1e3) {
      return `$${(tvl / 1e3).toFixed(2)}K`
    } else {
      return `$${tvl.toFixed(2)}`
    }
  }

  // Helper function to format wallet count
  const formatWallets = (count: number | null | undefined): string => {
    if (!count || count === 0) return "TO DO"
    return count.toLocaleString()
  }

  // Helper function to format revenue in millions
  const formatRevenue = (revenue: number | null | undefined): string => {
    if (!revenue || revenue === 0) return "TO DO"

    const absRevenue = Math.abs(revenue)

    if (absRevenue >= 1e6) {
      return `$${(revenue / 1e6).toFixed(2)}M`
    } else if (absRevenue >= 100e3) {
      // 100K to 999K: show as $XXXK (no decimals, 3 digits)
      return `$${Math.round(revenue / 1e3)}K`
    } else if (absRevenue >= 1e3) {
      return `$${(revenue / 1e3).toFixed(2)}K`
    } else {
      return `$${revenue.toFixed(2)}`
    }
  }

  // Helper function to format revenue change to 3 significant digits
  const formatRevenueChange = (revenue: number | null | undefined): string => {
    if (!revenue || revenue === 0) return "0"

    const absRevenue = Math.abs(revenue)
    const sign = revenue < 0 ? "-" : ""

    if (absRevenue >= 1e6) {
      // For millions, show 1 decimal place (e.g., $1.2M)
      return `${sign}${(absRevenue / 1e6).toFixed(1)}M`
    } else if (absRevenue >= 1e3) {
      // For thousands, show whole numbers (e.g., $676K)
      return `${sign}$${Math.round(absRevenue / 1e3)}K`
    } else {
      // For smaller amounts, show whole numbers
      return `${sign}$${Math.round(absRevenue)}`
    }
  }

  // Create metrics array with real data (excluding top 3 and HyperEVM metrics which are now in their own section)
  const metrics = [
    // Row 1: Ecosystem Metrics
    {
      title: "Hyperliquid TVL",
      value: duneLoading ? (
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
          <div className="h-4 bg-[#2d5a4f] rounded w-16"></div>
        </div>
      ) : duneData ? (
        formatTVL(duneData.tvl)
      ) : (
        "TO DO"
      ),
      change: duneLoading
        ? ""
        : duneData && duneData.previous_day_tvl
          ? `${duneData.tvl >= duneData.previous_day_tvl ? "+" : ""}${formatTVL(duneData.previous_day_tvl)} 24h`
          : "",
      isPositive: duneData && duneData.previous_day_tvl ? duneData.tvl >= duneData.previous_day_tvl : true,
      isLoading: duneLoading,
    },
    {
      title: "Daily Revenue",
      value: revenueLoading ? (
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
          <div className="h-4 bg-[#2d5a4f] rounded w-16"></div>
        </div>
      ) : revenueData && revenueData.daily_revenue > 0 ? (
        formatRevenue(revenueData.daily_revenue)
      ) : revenueError && revenueError.includes("sync first") ? (
        "Sync Needed"
      ) : (
        "TO DO"
      ),
      change: revenueLoading
        ? ""
        : revenueData && revenueData.previous_day_revenue && revenueData.daily_revenue
          ? `${revenueData.daily_revenue >= revenueData.previous_day_revenue ? "+" : ""}${formatRevenue(revenueData.daily_revenue - revenueData.previous_day_revenue)} 24h`
          : "",
      isPositive:
        revenueData && revenueData.previous_day_revenue
          ? revenueData.daily_revenue - revenueData.previous_day_revenue >= 0
          : true,
      isLoading: revenueLoading,
    },
    {
      title: "Annualized Revenue",
      value: revenueLoading ? (
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
          <div className="h-4 bg-[#2d5a4f] rounded w-16"></div>
        </div>
      ) : revenueData && revenueData.annualized_revenue > 0 ? (
        formatTVL(revenueData.annualized_revenue)
      ) : revenueError && revenueError.includes("sync first") ? (
        "Sync Needed"
      ) : (
        "TO DO"
      ),
      change: "",
      isPositive: true,
      isLoading: revenueLoading,
    },
    {
      title: "Total Wallets",
      value: duneLoading ? (
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
          <div className="h-4 bg-[#2d5a4f] rounded w-16"></div>
        </div>
      ) : duneData ? (
        formatWallets(duneData.total_wallets)
      ) : (
        "TO DO"
      ),
      change: duneLoading
        ? ""
        : duneData && duneData.previous_day_wallets
          ? `+${formatWallets(duneData.previous_day_wallets)} 24h`
          : "",
      isPositive:
        duneData && duneData.previous_day_wallets ? duneData.total_wallets >= duneData.previous_day_wallets : true,
      isLoading: duneLoading,
    },
  ]

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-8" style={{ marginTop: "30px" }}>
        {metrics.map((metric, index) => (
          <Card key={index} className="bg-[#062722] rounded-[10px] shadow-xl drop-shadow-lg overflow-hidden border-0">
            {/* Dark header section */}
            <div className="bg-[#0f1a1f] px-3 sm:px-4 py-2">
              <h3 className="text-[#868d8f] text-xs sm:text-sm font-medium font-sans">{metric.title}</h3>
            </div>

            {/* Body section with white top border */}
            <CardContent className="bg-[#0f1a1f] px-3 sm:px-4 py-3 border-0">
              {metric.isLoading ? (
                <>
                  {/* Mobile loading - only main value */}
                  <div className="block sm:hidden animate-pulse">
                    <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
                  </div>
                  {/* Desktop loading - main value + subtext */}
                  <div className="hidden sm:block animate-pulse flex items-center justify-between">
                    <div className="h-8 bg-[#2d5a4f] rounded w-24"></div>
                    <div className="h-4 bg-[#2d5a4f] rounded w-16"></div>
                  </div>
                </>
              ) : (
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl sm:text-3xl font-bold text-white font-teodor">{metric.value}</p>
                  {metric.change && (
                    <span
                      className={`hidden sm:inline text-xs font-medium font-sans ${metric.isPositive ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                    >
                      {metric.change}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {(cryptoError || duneError || hyperEVMError || revenueError) && (
          <Card className="bg-yellow-900/20 border-yellow-500/50 rounded-2xl overflow-hidden shadow col-span-full">
            <CardContent className="p-4">
              {cryptoError && <p className="text-yellow-400 text-sm font-sans">Crypto data error: {cryptoError}</p>}
              {duneError && <p className="text-yellow-400 text-sm font-sans">Dune data: {duneError}</p>}
              {hyperEVMError && <p className="text-yellow-400 text-sm font-sans">HyperEVM data: {hyperEVMError}</p>}
              {revenueError && <p className="text-yellow-400 text-sm font-sans">Revenue data: {revenueError}</p>}
              {duneError && duneError.includes("sync first") && (
                <p className="text-yellow-300 text-xs mt-1 font-sans">
                  💡 Run POST /api/dune-sync to populate the database with Dune data
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
