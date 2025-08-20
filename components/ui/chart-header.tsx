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
    <div className="bg-card/50 px-4 py-2 flex justify-between items-center h-[50px] border-b border-border/20">
      <h3 className="text-muted-foreground text-sm font-medium font-sans">{title}</h3>
      <div className="flex gap-1">
        {["7D", "30D", "90D", "MAX"].map((period) => (
          <button
            key={period}
            onClick={() => setTimeRange(period as "7D" | "30D" | "90D" | "MAX")}
            className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
              timeRange === period
                ? "bg-emerald-500 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-60"
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  )
}
