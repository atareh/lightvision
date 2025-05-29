"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Users, DollarSign, ArrowUpDown } from "lucide-react"

interface DuneResult {
  id: number
  execution_id: string
  query_id: number
  block_day: string
  address_count: number
  deposit: number
  withdraw: number
  netflow: number
  total_wallets: number
  tvl: number
  created_at: string
  updated_at: string
}

export default function Dashboard() {
  const [data, setData] = useState<DuneResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDuneData()
  }, [])

  const fetchDuneData = async () => {
    try {
      const response = await fetch("/api/dune-data")
      if (!response.ok) {
        throw new Error("Failed to fetch data")
      }
      const result = await response.json()
      setData(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate summary metrics from latest data
  const latestData = data.length > 0 ? data[data.length - 1] : null
  const totalTVL = latestData?.tvl || 0
  const totalAddresses = latestData?.address_count || 0
  const netFlow = latestData?.netflow || 0
  const totalDeposits = data.reduce((sum, item) => sum + (item.deposit || 0), 0)
  const totalWithdrawals = data.reduce((sum, item) => sum + Math.abs(item.withdraw || 0), 0)

  if (loading) {
    return (
      <div
        className="min-h-screen text-white"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <header className="border-b border-[#2d5a4f] p-4 md:p-6">
          <div className="container mx-auto">
            <div className="flex items-center gap-3">
              <img src="/images/blob_green.gif" alt="HyperScreener Logo" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">
                <span className="font-teodor font-normal">Hyper</span>
                <span className="font-teodor italic font-light">Screener</span>
              </h1>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-[#2d5a4f] rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-[#0f1a1f] border border-[#2d5a4f] rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="min-h-screen text-white"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <header className="border-b border-[#2d5a4f] p-4 md:p-6">
          <div className="container mx-auto">
            <div className="flex items-center gap-3">
              <img src="/images/blob_green.gif" alt="HyperScreener Logo" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">
                <span className="font-teodor font-normal">Hyper</span>
                <span className="font-teodor italic font-light">Screener</span>
              </h1>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-[#0f1a1f] border-[#ed7188] rounded-2xl">
            <CardContent className="p-6">
              <p className="text-[#ed7188]">Error loading data: {error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
      }}
    >
      <header className="border-b border-[#2d5a4f] p-4 md:p-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-3">
            <img src="/images/blob_green.gif" alt="HyperScreener Logo" className="w-8 h-8" />
            <h1 className="text-2xl font-bold">
              <span className="font-teodor font-normal">Hyper</span>
              <span className="font-teodor italic font-light">Screener</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10">
        <section>
          <h2 className="text-xl font-semibold mb-6">DeFi Analytics Dashboard</h2>
          <p className="text-[#868d8f] mb-6">Real-time insights from Dune Analytics</p>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#868d8f]">Total Value Locked</CardTitle>
                <DollarSign className="h-4 w-4 text-[#51d2c1]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-teodor">{formatCurrency(totalTVL)}</div>
                <p className="text-xs text-[#868d8f]">Current TVL across all protocols</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#868d8f]">Active Addresses</CardTitle>
                <Users className="h-4 w-4 text-[#51d2c1]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-teodor">{formatNumber(totalAddresses)}</div>
                <p className="text-xs text-[#868d8f]">Unique addresses interacting</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#868d8f]">Net Flow</CardTitle>
                {netFlow >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-[#20a67d]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[#ed7188]" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold font-teodor ${netFlow >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}>
                  {formatCurrency(netFlow)}
                </div>
                <p className="text-xs text-[#868d8f]">{netFlow >= 0 ? "Net inflow" : "Net outflow"}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#868d8f]">Total Volume</CardTitle>
                <ArrowUpDown className="h-4 w-4 text-[#51d2c1]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-teodor">{formatCurrency(totalDeposits + totalWithdrawals)}</div>
                <p className="text-xs text-[#868d8f]">Deposits + Withdrawals</p>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="bg-[#0f1a1f] border-[#51d2c1] rounded-2xl shadow">
            <CardHeader>
              <CardTitle className="text-white">Historical Data</CardTitle>
              <CardDescription className="text-[#868d8f]">
                Daily metrics from Dune Analytics ({data.length} records)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="rounded-2xl border border-[#2d5a4f] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2d5a4f] bg-[#01493a]">
                        <th className="text-left p-4 text-[#868d8f]">Date</th>
                        <th className="text-right p-4 text-[#868d8f]">TVL</th>
                        <th className="text-right p-4 text-[#868d8f]">Addresses</th>
                        <th className="text-right p-4 text-[#868d8f]">Deposits</th>
                        <th className="text-right p-4 text-[#868d8f]">Withdrawals</th>
                        <th className="text-right p-4 text-[#868d8f]">Net Flow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data
                        .slice(-10)
                        .reverse()
                        .map((item) => (
                          <tr key={item.id} className="border-b border-[#2d5a4f] hover:bg-[#2d5a4f]/50">
                            <td className="p-4">
                              <div className="font-medium text-white">{formatDate(item.block_day)}</div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-medium text-white">{formatCurrency(item.tvl)}</div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Users className="h-3 w-3 text-[#51d2c1]" />
                                <span className="text-white">{formatNumber(item.address_count)}</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <Badge variant="outline" className="text-[#20a67d] border-[#20a67d] bg-[#20a67d]/10">
                                +{formatCurrency(item.deposit)}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <Badge variant="outline" className="text-[#ed7188] border-[#ed7188] bg-[#ed7188]/10">
                                {formatCurrency(item.withdraw)}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  item.netflow >= 0
                                    ? "text-[#20a67d] border-[#20a67d] bg-[#20a67d]/10"
                                    : "text-[#ed7188] border-[#ed7188] bg-[#ed7188]/10"
                                }
                              >
                                {item.netflow >= 0 ? "+" : ""}
                                {formatCurrency(item.netflow)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
