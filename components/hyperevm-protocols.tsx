import { useHyperEVMData } from "@/hooks/useHyperEVMData"
import { formatTVL } from "@/utils/formatter"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

const HyperEVMProtocols = () => {
  const { hyperEVMData, hyperEVMLoading, hyperEVMError } = useHyperEVMData()

  const metrics = [
    {
      title: "HyperEVM TVL",
      value: hyperEVMLoading ? null : hyperEVMData?.tvl,
      change: hyperEVMLoading
        ? ""
        : hyperEVMData && hyperEVMData.previous_day_tvl
          ? `${formatTVL(hyperEVMData.previous_day_tvl)} 24h`
          : "",
      isLoading: hyperEVMLoading,
      isPositive: hyperEVMData?.tvl > hyperEVMData?.previous_day_tvl,
    },
  ]

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-4">HyperEVM</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-2">
              <div className="text-sm font-medium">{metric.title}</div>
              {metric.isLoading ? (
                <Skeleton className="w-[120px] h-[24px]" />
              ) : (
                <div className="text-2xl font-bold">{metric.value ? formatTVL(metric.value) : "N/A"}</div>
              )}
              <span className={`hidden sm:inline text-xs font-medium font-sans text-[#868d8f]`}>{metric.change}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default HyperEVMProtocols
