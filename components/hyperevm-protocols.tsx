"use client"

import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { formatTVL } from "@/lib/utils"
import { MetricsCard } from "@/components/ui/metrics-card"

const HyperEVMProtocols = () => {
  const { data: hyperEVMData, loading: hyperEVMLoading, error: hyperEVMError } = useHyperEVMData()

  console.log("HyperEVMProtocols (single card) - Fetched Data:", hyperEVMData)

  const tvlMetric = {
    title: "HyperEVM TVL", // This is the single card for total TVL
    value: hyperEVMData?.current_tvl ?? 0,
    change: hyperEVMData?.daily_change
      ? `${hyperEVMData.daily_change >= 0 ? "+" : ""}${formatTVL(hyperEVMData.daily_change)} 24h`
      : undefined,
    isPositive: (hyperEVMData?.daily_change ?? 0) >= 0,
    lastUpdated: hyperEVMData?.last_updated,
  }

  if (hyperEVMError) {
    return (
      <div className="w-full p-4 text-red-500 bg-red-100 border border-red-500 rounded-md">
        <p className="font-bold">Error loading HyperEVM data:</p>
        <p>{typeof hyperEVMError === "string" ? hyperEVMError : JSON.stringify(hyperEVMError)}</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <MetricsCard
        title={tvlMetric.title}
        value={hyperEVMLoading ? "Loading..." : formatTVL(tvlMetric.value)}
        change={tvlMetric.change}
        isPositive={tvlMetric.isPositive}
        isLoading={hyperEVMLoading}
        updateFrequencyHours={3}
        lastUpdatedAt={tvlMetric.lastUpdated}
        showIndicator={true}
      />
    </div>
  )
}

export default HyperEVMProtocols
