"use client"

interface ChartHeaderProps {
  title: string
  timeRange: "7D" | "30D" | "90D" | "MAX"
  setTimeRange: (range: "7D" | "30D" | "90D" | "MAX") => void
  isHidden?: boolean
}

export function ChartHeader({ title, timeRange, setTimeRange, isHidden }: ChartHeaderProps) {
  if (isHidden) {
    return null
  }

  return (
    <div className="bg-[#0f1a1f] px-4 py-2 flex justify-between items-center h-[50px]">
      <h3 className="text-[#868d8f] text-sm font-medium font-sans">{title}</h3>
      <div className="flex gap-1">
        {["7D", "30D", "90D", "MAX"].map((period) => (
          <button
            key={period}
            onClick={() => setTimeRange(period as "7D" | "30D" | "90D" | "MAX")}
            className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
              timeRange === period
                ? "bg-[#00c2c2] text-white"
                : "text-[#868d8f] hover:text-white hover:bg-[#00c2c280] focus:outline-none focus:ring-2 focus:ring-[#00c2c2] focus:ring-opacity-60"
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  )
}
