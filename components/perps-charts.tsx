"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Placeholder data for stacked area chart
const volumeData = [
  { month: "Jan", HL: 4000, Binance: 2400 },
  { month: "Feb", HL: 3000, Binance: 1398 },
  { month: "Mar", HL: 2000, Binance: 9800 },
  { month: "Apr", HL: 2780, Binance: 3908 },
  { month: "May", HL: 1890, Binance: 4800 },
  { month: "Jun", HL: 2390, Binance: 3800 },
  { month: "Jul", HL: 3490, Binance: 4300 },
  { month: "Aug", HL: 4000, Binance: 2400 },
  { month: "Sep", HL: 3000, Binance: 1398 },
  { month: "Oct", HL: 2000, Binance: 9800 },
  { month: "Nov", HL: 2780, Binance: 3908 },
  { month: "Dec", HL: 1890, Binance: 4800 },
]

export default function PerpsCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Stacked Area Chart */}
      <Card className="bg-[#1a4037] border-[#2d5a4f] rounded-2xl shadow">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium mb-4">HL vs Binance Volume</h3>
          <div className="h-[300px]">
            <ChartContainer
              config={{
                HL: {
                  label: "HyperLiquid",
                  color: "#dafaf6",
                },
                Binance: {
                  label: "Binance",
                  color: "#fef08a",
                },
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d5a4f" />
                  <XAxis dataKey="month" stroke="#dafaf6" tick={{ fill: "#e2e8f0" }} />
                  <YAxis stroke="#dafaf6" tick={{ fill: "#e2e8f0" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="Binance"
                    stackId="1"
                    stroke="#fef08a"
                    fill="#fef08a"
                    fillOpacity={0.6}
                  />
                  <Area type="monotone" dataKey="HL" stackId="1" stroke="#dafaf6" fill="#dafaf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
