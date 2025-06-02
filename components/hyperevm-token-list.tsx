"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { useTokenData } from "@/hooks/use-token-data"
import { ArrowUpDown, Search, X } from "lucide-react"
import { MouseToast } from "@/components/ui/mouse-toast"
import { useMemesMetrics } from "@/hooks/use-memes-metrics"
import HyperEVMChart from "@/components/hyperevm-chart"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MetricsCard } from "@/components/ui/metrics-card"
import { ChartHeader } from "@/components/ui/chart-header"
import DesktopTokenTableSkeleton from "@/components/token-list/desktop-token-table-skeleton"
import MobileTokenCardSkeleton from "@/components/token-list/mobile-token-card-skeleton"
import MobileTokenCard from "@/components/token-list/mobile-token-card" // Default import
import PaginationControls from "@/components/token-list/pagination-controls"
import TokenTable from "@/components/token-list/token-table" // Default import
import { formatTVL, formatPrice, formatPercentageChange, formatAge } from "@/lib/utils"

const TOKENS_PER_PAGE = 10

// Add shimmer animation styles
const shimmerStyles = `
@keyframes shimmer {
0% {
 background-position: -200% 0;
}
100% {
 background-position: 200% 0;
}
}
`

// Add the styles to the document head if not already added
if (typeof document !== "undefined" && !document.getElementById("shimmer-styles")) {
  const style = document.createElement("style")
  style.id = "shimmer-styles"
  style.textContent = shimmerStyles
  document.head.appendChild(style)
}

export default function HyperEVMTokenList() {
  const { data: hyperEVMData, loading: hyperEVMLoading, error: hyperEVMError } = useHyperEVMData()
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [isSticky, setIsSticky] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const {
    data: tokenData,
    loading: tokenLoading,
    error: tokenError,
    updatingTokens,
    getTokenChanges,
    isRefreshing,
    currentPage,
    goToPage,
    sortColumn,
    sortDirection,
    searchTerm,
    setSort,
    setSearch,
    clearSearch,
    allTokensCache,
  } = useTokenData()

  const { data: memesMetrics, loading: memesLoading, error: memesError } = useMemesMetrics()
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "MAX">("7D")

  // Intersection Observer for sticky behavior
  useEffect(() => {
    if (!triggerRef.current || !pillRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: "-80px 0px 0px 0px", // Account for navbar height
      },
    )

    observer.observe(triggerRef.current)

    return () => observer.disconnect()
  }, [])

  const copyToClipboard = async (text: string, event: React.MouseEvent, message = "Copied!") => {
    try {
      await navigator.clipboard.writeText(text)
      setClickPosition({ x: event.clientX, y: event.clientY })
      setToastMessage(message)
      setShowToast(true)
    } catch (err) {
      console.error("Failed to copy:", err)
      setClickPosition({ x: event.clientX, y: event.clientY })
      setToastMessage("Failed tocopy")
      setShowToast(true)
    }
  }

  const handleSort = (column: string) => {
    const newDirection = sortColumn === column && sortDirection === "desc" ? "asc" : "desc"
    setSort(column, newDirection)
    goToPage(1) // Reset to first page when sorting
  }

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === "asc" ? (
      <ArrowUpDown className="ml-2 h-4 w-4 text-blue-400" />
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4 text-blue-400 transform rotate-180" />
    )
  }

  // Helper function to get animation classes for a cell
  const getCellAnimationClasses = (tokenId: string, field: string) => {
    const changes = getTokenChanges(tokenId)
    const change = changes.find((c) => c.field === field)
    const isUpdating = updatingTokens.has(tokenId)

    if (!change || !isUpdating) return ""

    // Base animation classes
    let classes = "transition-all duration-1000 ease-out "

    if (change.isNumeric && change.isPositive !== undefined) {
      // Green for positive changes, red for negative
      if (change.isPositive) {
        classes += "animate-pulse bg-green-500/20 border-green-400/50 shadow-green-400/25 shadow-lg"
      } else {
        classes += "animate-pulse bg-red-500/20 border-red-400/50 shadow-red-400/25 shadow-lg"
      }
    } else {
      // Neutral blue for non-numeric changes
      classes += "animate-pulse bg-blue-500/20 border-blue-400/50 shadow-blue-400/25 shadow-lg"
    }

    return classes
  }

  // Helper function to get row animation classes
  const getRowAnimationClasses = (tokenId: string) => {
    return ""
  }

  // Pagination calculations - use data from hook
  const totalTokens = tokenData?.totalCount || 0
  const totalPages = tokenData?.totalPages || 1
  const startIndex = (currentPage - 1) * TOKENS_PER_PAGE
  const endIndex = Math.min(startIndex + TOKENS_PER_PAGE, totalTokens)

  const chartData = useMemo(() => {
    if (!hyperEVMData?.historical_data) return []
    const now = new Date()
    let daysToShow = 7
    if (timeRange === "30D") daysToShow = 30
    if (timeRange === "90D") daysToShow = 90
    if (timeRange === "MAX") daysToShow = hyperEVMData.historical_data.length

    const sortedData = [...hyperEVMData.historical_data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    if (timeRange !== "MAX") {
      return sortedData.slice(-daysToShow)
    }
    return sortedData
  }, [hyperEVMData, timeRange])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 min-w-0 h-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden">
          <CardContent className="px-4 py-2 h-[528px] flex flex-col justify-start">
            <ChartHeader title="HyperEVM TVL" timeRange={timeRange} setTimeRange={setTimeRange} />
            <div className="bg-[#0f1a1f] p-0 flex-1 overflow-hidden">
              {hyperEVMLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse bg-[#2d5a4f] rounded w-full h-full"></div>
                </div>
              ) : (
                <div className="w-full h-full">
                  <HyperEVMChart chartData={chartData} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-[200px] lg:h-[528px] lg:gap-0">
          <MetricsCard
            title="HyperEVM TVL"
            value={
              hyperEVMLoading ? (
                <div className="animate-pulse h-8 bg-[#2d5a4f] rounded w-24"></div>
              ) : hyperEVMData && hyperEVMData.current_tvl > 0 ? (
                formatTVL(hyperEVMData.current_tvl)
              ) : hyperEVMError && hyperEVMError.includes("sync first") ? (
                "Sync Needed"
              ) : (
                "TO DO"
              )
            }
            change={
              hyperEVMLoading
                ? ""
                : hyperEVMData && typeof hyperEVMData.daily_change === "number"
                  ? ` ${hyperEVMData.daily_change >= 0 ? "▲ " : "▼ "} ${formatTVL(
                      Math.abs(hyperEVMData.daily_change),
                    )} 24h`
                  : ""
            }
            isPositive={hyperEVMData ? hyperEVMData.daily_change >= 0 : true}
            isLoading={hyperEVMLoading}
          />
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] cursor-pointer">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="text-[#a0a8aa] text-xs font-medium">
                      <span className="sm:hidden">Altcoin Mkt Cap</span>
                      <span className="hidden sm:inline">Altcoin Market Cap</span>
                    </h3>
                  </div>
                  <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
                    {tokenLoading ? (
                      <div className="flex flex-col justify-start space-y-2">
                        <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                        <div className="flex items-center h-4">
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-start space-y-2">
                        <p className="text-2xl font-bold text-white font-teodor tracking-tight">
                          {tokenData?.totalMarketCap ? formatTVL(tokenData.totalMarketCap) : "TO DO"}
                        </p>
                        <div className="flex items-center h-4">
                          {memesMetrics?.marketCapChange !== null && memesMetrics?.marketCapChange !== undefined && (
                            <span
                              className={`text-xs font-medium flex items-center gap-1 ${memesMetrics.marketCapChange >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                              style={{ fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {memesMetrics.marketCapChange >= 0 ? "▲ " : "▼ "}
                              {formatTVL(Math.abs(memesMetrics.marketCapChange))} 24h
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming Soon!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] cursor-pointer">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="text-[#a0a8aa] text-xs font-medium">
                      <span className="sm:hidden">24h Volume</span>
                      <span className="hidden sm:inline">24h Volume</span>
                    </h3>
                  </div>
                  <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
                    {tokenLoading ? (
                      <div className="flex flex-col justify-start space-y-2">
                        <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                        <div className="flex items-center h-4">
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-start space-y-2">
                        <p className="text-2xl font-bold text-white font-teodor tracking-tight">
                          {tokenData?.totalVolume24h ? formatTVL(tokenData.totalVolume24h) : "TO DO"}
                        </p>
                        <div className="flex items-center h-4">
                          {memesMetrics?.volumeChange !== null && memesMetrics?.volumeChange !== undefined && (
                            <span
                              className={`text-xs font-medium flex items-center gap-1 ${memesMetrics.volumeChange >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                              style={{ fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {memesMetrics.volumeChange >= 0 ? "▲ " : "▼ "}
                              {formatTVL(Math.abs(memesMetrics.volumeChange))} 24h
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming Soon!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Card className="w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50]">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-[#a0a8aa] text-xs font-medium">
                <span className="sm:hidden">Tracked Tokens</span>
                <span className="hidden sm:inline">Tracked Tokens</span>
              </h3>
            </div>
            <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
              {tokenLoading ? (
                <div className="flex flex-col justify-start space-y-2">
                  <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                  <div className="flex items-center h-4">
                    <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-start space-y-2">
                  <p className="text-2xl font-bold text-white font-teodor tracking-tight">
                    {tokenData?.filteredCount !== undefined
                      ? allTokensCache?.length || tokenData.totalCount || 0
                      : "TO DO"}
                  </p>
                  <div className="flex items-center h-4"></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card className="bg-[#0f1a1f] border-[#51d2c1] rounded-2xl shadow">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold">HyperEVM Tokens</h3>
            </div>
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by name, symbol, or contract address..."
                value={searchTerm}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 w-full bg-[#2d5a4f] border-[#2d5a4f] text-white placeholder:text-gray-400 focus:border-[#51d2c1] focus:ring-[#51d2c1]"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-[#51d2c1]/20"
                >
                  <X className="h-3 w-3 text-gray-400 hover:text-white" />
                </Button>
              )}
            </div>
          </div>
          <div className="mb-4 h-5 flex items-center">
            {searchTerm ? (
              <div className="text-sm text-gray-400">
                {totalTokens === 0 ? (
                  <span>No tokens found for "{searchTerm}"</span>
                ) : (
                  <span>
                    Found {totalTokens} token{totalTokens === 1 ? "" : "s"} matching "{searchTerm}"
                  </span>
                )}
              </div>
            ) : totalTokens > 0 ? (
              <div className="text-sm text-gray-400">
                Showing {startIndex + 1}-{endIndex} of {totalTokens}
              </div>
            ) : null}
          </div>
          {tokenError ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-[#ed7188] text-lg">{tokenError}</p>
            </div>
          ) : tokenLoading ? (
            <div className="relative">
              <DesktopTokenTableSkeleton />
              <MobileTokenCardSkeleton />
            </div>
          ) : !tokenData?.tokens || tokenData.tokens.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                {searchTerm ? (
                  <>
                    <p className="text-gray-400 text-lg mb-2">No tokens found</p>
                    <p className="text-gray-500 text-sm">Try a different search term or clear the search</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-lg mb-2">No tokens found</p>
                    <p className="text-gray-500 text-sm">Add some tokens in the admin panel to get started</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="relative hidden md:block">
                <TokenTable
                  tokens={tokenData.tokens}
                  handleSort={handleSort}
                  renderSortIcon={renderSortIcon}
                  formatPrice={formatPrice}
                  formatTVL={formatTVL}
                  formatPercentageChange={formatPercentageChange}
                  formatAge={formatAge}
                  copyToClipboard={copyToClipboard}
                  getCellAnimationClasses={getCellAnimationClasses}
                  getRowAnimationClasses={getRowAnimationClasses}
                />
              </div>
              {/* Mobile Cards */}
              <div className="block md:hidden">
                <div className="space-y-3">
                  {tokenData.tokens.map((token) => (
                    <MobileTokenCard
                      key={token.id}
                      token={token}
                      formatPrice={formatPrice}
                      formatTVL={formatTVL}
                      formatPercentageChange={formatPercentageChange}
                      copyToClipboard={copyToClipboard}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          {/* Pagination Controls - Common for both, but styled differently or shown conditionally if needed */}
          {/* For simplicity, showing one set of controls that might need responsive styling or duplication */}
          {tokenData && tokenData.tokens && tokenData.tokens.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              goToPage={goToPage}
              isRefreshing={isRefreshing}
              // isMobile prop can be used by PaginationControls to adjust its layout
              // For now, let's assume it handles responsiveness internally or we use two separate controls
            />
          )}
        </CardContent>
      </Card>
      <div className="flex justify-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#0f1a1f] border border-[#868d8f]/30 text-[#868d8f] shadow-lg backdrop-blur-sm cursor-pointer hover:border-[#51d2c1]/50 hover:text-[#51d2c1] transition-colors"
          onClick={() => window.open("https://app.hyperliquid.xyz/join/ATAREH", "_blank")}
        >
          <span>Join Hyperliquid</span>
        </div>
      </div>
      {showToast && (
        <MouseToast
          showToast={showToast}
          setShowToast={setShowToast}
          toastMessage={toastMessage}
          clickPosition={clickPosition}
        />
      )}
    </div>
  )
}
