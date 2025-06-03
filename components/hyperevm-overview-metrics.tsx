"use client"
import { MetricsCard } from "@/components/ui/metrics-card"
import { formatTVL } from "@/lib/utils" // formatPercentageChange is no longer needed here
import type { HyperEVMData } from "@/hooks/use-hyperevm-data"
import type { TokenDataHookReturn } from "@/hooks/use-token-data"
import type { MemesMetricsData } from "@/hooks/use-memes-metrics"

interface HyperEVMOverviewMetricsProps {
  hyperEVMData?: HyperEVMData | null
  hyperEVMLoading: boolean
  tokenListData?: TokenDataHookReturn["data"]
  tokenListLoading: boolean
  memesMetricsData?: MemesMetricsData | null
  memesMetricsLoading: boolean
  onCardClick?: (metric: "tvl" | "marketCap" | "volume" | "trackedTokens") => void
  activeMetric?: string
}

export default function HyperEVMOverviewMetrics({
  hyperEVMData,
  hyperEVMLoading,
  tokenListData,
  tokenListLoading,
  memesMetricsData,
  memesMetricsLoading,
  onCardClick,
  activeMetric,
}: HyperEVMOverviewMetricsProps) {
  // DEBUG LOGS (can be removed once confirmed)
  // console.log("HyperEVMOverviewMetrics - Received memesMetricsData:", memesMetricsData);
  // if (memesMetricsData) {
  //   console.log("Market Cap Change from memes:", memesMetricsData.marketCapChange);
  //   console.log("Volume Change from memes:", memesMetricsData.volumeChange);
  // }

  // 1. HyperEVM TVL Card Data
  const tvlMetric = {
    title: "HyperEVM TVL",
    value: hyperEVMData?.current_tvl ?? 0,
    change:
      hyperEVMData?.daily_change !== undefined && hyperEVMData?.daily_change !== null
        ? `${hyperEVMData.daily_change >= 0 ? "+" : ""}${formatTVL(Math.abs(hyperEVMData.daily_change))} 24h`
        : undefined,
    isPositive: (hyperEVMData?.daily_change ?? 0) >= 0,
    lastUpdated: hyperEVMData?.last_updated,
    isLoading: hyperEVMLoading,
    updateFrequencyHours: 4,
    dataKey: "tvl",
    color: "#20a67d",
    isRealtime: false,
  }

  // 2. Altcoin Market Cap Card Data
  const rawMarketCapChange = memesMetricsData?.marketCapChange
  const marketCapMetric = {
    title: "Altcoin Market Cap",
    value: tokenListData?.totalMarketCap ?? 0,
    change:
      rawMarketCapChange !== undefined && rawMarketCapChange !== null
        ? `${rawMarketCapChange >= 0 ? "+" : ""}${formatTVL(Math.abs(rawMarketCapChange))} 24h`
        : undefined,
    isPositive: (rawMarketCapChange ?? 0) >= 0,
    isLoading: tokenListLoading || memesMetricsLoading,
    dataKey: "marketCap",
    color: "#4f9eff",
    isRealtime: true,
  }

  // 3. 24H Volume Card Data
  const rawVolumeChange = memesMetricsData?.volumeChange
  const volumeMetric = {
    title: "24H Volume",
    value: tokenListData?.totalVolume24h ?? 0,
    change:
      rawVolumeChange !== undefined && rawVolumeChange !== null
        ? `${rawVolumeChange >= 0 ? "+" : ""}${formatTVL(Math.abs(rawVolumeChange))} 24h`
        : undefined,
    isPositive: (rawVolumeChange ?? 0) >= 0,
    isLoading: tokenListLoading || memesMetricsLoading,
    dataKey: "volume",
    color: "#ff8c42",
    isRealtime: true,
  }

  // 4. Tracked Tokens Card Data
  const trackedTokensMetric = {
    title: "Tracked Tokens",
    value: tokenListData?.totalCount ?? 0,
    isLoading: tokenListLoading,
    dataKey: "trackedTokens",
    color: "#8b5cf6",
    isRealtime: true,
    // No 'change' for tracked tokens count unless specified
  }

  const metrics = [tvlMetric, marketCapMetric, volumeMetric, trackedTokensMetric]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-full lg:max-w-[200px] lg:h-full lg:min-h-[528px]">
      {metrics.map((metric) => (
        <MetricsCard
          key={metric.dataKey}
          title={metric.title}
          value={
            metric.isLoading
              ? "Loading..."
              : metric.title === "Tracked Tokens"
                ? metric.value // Display as raw number
                : formatTVL(metric.value as number) // Format other main values as currency/TVL
          }
          change={metric.change} // This is now the formatted currency string with "24h" suffix
          isPositive={metric.isPositive}
          isLoading={metric.isLoading}
          updateFrequencyHours={metric.updateFrequencyHours}
          lastUpdatedAt={metric.lastUpdated}
          showIndicator={true}
          active={activeMetric === metric.dataKey}
          onClick={() => onCardClick?.(metric.dataKey as any)}
          color={metric.color}
          isRealtime={metric.isRealtime}
          showChangeArrow={true} // This tells MetricsCard to show the arrow
        />
      ))}
    </div>
  )
}
