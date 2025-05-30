"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { useTokenData } from "@/hooks/use-token-data"
import { ArrowUpDown, Copy, ChevronLeft, ChevronRight, Loader2, ExternalLink, Search, X } from "lucide-react"
import { MouseToast } from "@/components/ui/mouse-toast"
import { useMemesMetrics } from "@/hooks/use-memes-metrics"
import HyperEVMChart from "@/components/hyperevm-chart"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

  // Helper function to format TVL with specific decimal rules
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
    } else if (absTvl >= 100e3) {
      // 100K to 999K: $XXXk format (no decimals)
      return `$${Math.round(tvl / 1e3)}K`
    } else if (absTvl >= 1e3) {
      // 1K to 99K: X.XK format (1 decimal)
      return `$${(tvl / 1e3).toFixed(1)}K`
    } else {
      return `$${tvl.toFixed(2)}`
    }
  }

  const formatPrice = (price: number | null): string => {
    if (!price) return "—"

    // For very small numbers, use subscript notation when there are 3+ leading zeros
    if (price < 0.001) {
      const str = price.toFixed(10)
      const match = str.match(/^0\.0*/)
      if (match) {
        const leadingZeros = match[0].length - 2 // subtract "0."
        if (leadingZeros >= 3) {
          const significantDigits = str.slice(match[0].length, match[0].length + 2)

          // Convert number to subscript using Unicode subscript characters
          const subscriptMap: { [key: string]: string } = {
            "0": "₀",
            "1": "₁",
            "2": "₂",
            "3": "₃",
            "4": "₄",
            "5": "₅",
            "6": "₆",
            "7": "₇",
            "8": "₈",
            "9": "₉",
          }
          const subscriptZeros = leadingZeros
            .toString()
            .split("")
            .map((digit) => subscriptMap[digit])
            .join("")

          return `$0.0${subscriptZeros}${significantDigits}`
        }
      }
    }

    // For small numbers less than $1, show up to 3 decimal places
    if (price < 1) {
      return `$${price.toFixed(3)}`
    }

    // For numbers $1-$999, show 2 decimals
    if (price < 1000) {
      return `$${price.toFixed(2)}`
    }

    // For numbers $1K-$999K, show as K with 1 decimal
    if (price < 1000000) {
      return `$${(price / 1000).toFixed(1)}K`
    }

    // For numbers $1M+, show as M with 1 decimal
    return `$${(price / 1000000).toFixed(1)}M`
  }

  const formatPercentage = (value: number | null): string => {
    if (value === null || value === undefined) return "—"

    const absValue = Math.abs(value)
    const sign = value >= 0 ? "+" : ""

    // For very large numbers (>=1000), use K notation
    if (absValue >= 1000) {
      const kValue = value / 1000
      // Try 1 decimal first
      const oneDecimal = `${sign}${kValue.toFixed(1)}K%`
      if (oneDecimal.length <= 6) return oneDecimal
      // If too long, round to whole number
      return `${sign}${Math.round(kValue)}K%`
    }

    // For medium numbers (>=100), no decimals
    if (absValue >= 100) {
      return `${sign}${Math.round(value)}%`
    }

    // For smaller numbers (<100), use 1-2 decimals but ensure max 6 chars
    if (absValue >= 10) {
      // Try 1 decimal first
      const oneDecimal = `${sign}${value.toFixed(1)}%`
      if (oneDecimal.length <= 6) return oneDecimal
      // If too long, round to whole number
      return `${sign}${Math.round(value)}%`
    }

    // For very small numbers (<10), use 2 decimals but check length
    const twoDecimals = `${sign}${value.toFixed(2)}%`
    if (twoDecimals.length <= 6) return twoDecimals

    // Fallback to 1 decimal
    const oneDecimal = `${sign}${value.toFixed(1)}%`
    if (oneDecimal.length <= 6) return oneDecimal

    // Final fallback to whole number
    return `${sign}${Math.round(value)}%`
  }

  const formatAge = (createdAt: string | null): string => {
    if (!createdAt) return "—"
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return "Today"
    if (days === 1) return "1 day"
    return `${days} days`
  }

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
    // Removed the scaling animation - it doesn't work well for tables
    return ""
  }

  // Pagination calculations - use data from hook
  const totalTokens = tokenData?.totalCount || 0
  const totalPages = tokenData?.totalPages || 1
  const startIndex = (currentPage - 1) * TOKENS_PER_PAGE
  const endIndex = Math.min(startIndex + TOKENS_PER_PAGE, totalTokens)

  // Update the HyperEVMChart component to properly handle the data structure

  return (
    <div className="space-y-6">
      {/* HyperEVM Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* HyperEVM TVL Chart - Full Height on Left */}
        <Card className="lg:col-span-3 h-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden">
          <CardContent className="px-4 py-2 h-full flex flex-col justify-start">
            {hyperEVMLoading ? (
              <div className="flex flex-col flex-1">
                <div className="flex flex-col justify-start space-y-2">
                  <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                  <div className="flex items-center h-4">
                    <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
                  </div>
                </div>
                <div className="animate-pulse flex-1 bg-[#2d5a4f] rounded w-full mt-4"></div>
              </div>
            ) : (
              <div className="flex flex-col justify-start flex-1">
                {/* SVG Chart - Now fills all available space */}
                <div className="flex-1 mt-4">
                  <HyperEVMChart />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right side metrics - 4 cards stacked */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-[200px] lg:h-[528px] lg:gap-0">
          {/* HyperEVM TVL Value Card */}
          <Card className="w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] relative before:absolute before:inset-0.5 before:rounded-lg before:border before:border-[#20a67d] before:pointer-events-none">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-[#a0a8aa] text-xs font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#20a67d]"></div>
                HyperEVM TVL
              </h3>
            </div>
            <CardContent className="px-4 py-2 pb-3 border-t border-[#1a2e2a] flex flex-col justify-start space-y-2">
              {hyperEVMLoading ? (
                <div className="flex flex-col justify-start space-y-2">
                  <div className="animate-pulse h-7 bg-[#2d5a4f] rounded w-24"></div>
                  <div className="flex items-center h-4">
                    <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16"></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-start space-y-2">
                  <p className="text-2xl font-bold text-white font-teodor tracking-tight">
                    {hyperEVMData && hyperEVMData.current_tvl > 0
                      ? formatTVL(hyperEVMData.current_tvl)
                      : hyperEVMError && hyperEVMError.includes("sync first")
                        ? "Sync Needed"
                        : "TO DO"}
                  </p>
                  <div className="flex items-center h-4">
                    {hyperEVMData && hyperEVMData.daily_change !== 0 && (
                      <span
                        className={`text-xs font-medium flex items-center gap-1 ${hyperEVMData.daily_change >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {hyperEVMData.daily_change >= 0 ? "▲ " : "▼ "}
                        {formatTVL(Math.abs(hyperEVMData.daily_change))} 24h
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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

      {/* Token List Table */}
      <Card className="bg-[#0f1a1f] border-[#51d2c1] rounded-2xl shadow">
        <CardContent className="p-6">
          {/* Fixed Header with Search Bar */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold">HyperEVM Tokens</h3>
            </div>

            {/* Search Bar - Fixed Position */}
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

          {/* Dynamic Status Text - Always in Same Position */}
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
              {/* Desktop Loading State */}
              <div className="hidden md:block rounded-2xl border border-[#003c26] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
                      <TableHead className="text-gray-300 w-[160px]">
                        <div className="flex items-center">Token</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[100px]">Trade</TableHead>
                      <TableHead className="text-gray-300 w-[100px]">
                        <div className="flex items-center">Price</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[150px]">
                        <div className="flex items-center">Market Cap</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]">
                        <div className="flex items-center">1h</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]">
                        <div className="flex items-center">24h</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[140px]">
                        <div className="flex items-center">Volume 24h</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[140px]">
                        <div className="flex items-center">Liquidity</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]">
                        <div className="flex items-center">Age</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`} className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f]">
                        <TableCell className="font-medium w-[160px]">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>
                            <div>
                              <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded mb-1"></div>
                              <div className="h-3 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                              <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <div className="h-7 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[150px]">
                          <div className="h-4 w-24 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[80px]">
                          <div className="h-6 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[80px]">
                          <div className="h-6 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[140px]">
                          <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[140px]">
                          <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                        <TableCell className="w-[80px]">
                          <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                          <div className="animate-pulse h-3 bg-[#2d5a4f] rounded w-16 mt-2"></div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Loading State */}
              <div className="block md:hidden space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`mobile-skeleton-${index}`} className="bg-[#0f1a1f] border border-[#2d5a4f] rounded-lg p-3">
                    {/* Row 1: Token Info + Price + Performance */}
                    <div className="flex items-center justify-between mb-2">
                      {/* Left: Token Info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Token Icon */}
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>
                        {/* Token Symbol */}
                        <div className="h-4 w-12 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                      </div>

                      {/* Right: Price + Performance */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Price */}
                        <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                        {/* 24H Change */}
                        <div className="h-4 w-12 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                      </div>
                    </div>

                    {/* Row 2: Contract + Metrics */}
                    {/* Row 2: Contract Address + Social Links */}
                    <div className="flex flex-col space-y-2 mb-3">
                      {/* Top row: Contract Address + Social Links */}
                      <div className="flex items-center justify-between">
                        {/* Left: Contract Address */}
                        <div className="h-3 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>

                        {/* Right: Social Links */}
                        <div className="text-xs text-[#868d8f] flex items-center gap-2">
                          <span className="opacity-60">—</span>
                        </div>
                      </div>

                      {/* Bottom row: Key Metrics */}
                      <div className="flex items-center justify-between text-[10px] text-[#868d8f]">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="relative hidden md:block">
              <div className="rounded-2xl border border-[#003c26] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
                      <TableHead className="text-gray-300 w-[160px]">
                        <div className="flex items-center">Token</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[100px]">Trade</TableHead>
                      <TableHead className="text-gray-300 w-[100px]" onClick={() => handleSort("price_usd")}>
                        <div className="flex items-center cursor-pointer">Price {renderSortIcon("price_usd")}</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[150px]" onClick={() => handleSort("market_cap")}>
                        <div className="flex items-center cursor-pointer">
                          Market Cap {renderSortIcon("market_cap")}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("price_change_30m")}>
                        <div className="flex items-center cursor-pointer">1h {renderSortIcon("price_change_30m")}</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("price_change_24h")}>
                        <div className="flex items-center cursor-pointer">24h {renderSortIcon("price_change_24h")}</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[140px]" onClick={() => handleSort("volume_24h")}>
                        <div className="flex items-center cursor-pointer">Vol. 24h {renderSortIcon("volume_24h")}</div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[140px]" onClick={() => handleSort("liquidity_usd")}>
                        <div className="flex items-center cursor-pointer">
                          Liquidity {renderSortIcon("liquidity_usd")}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("age_days")}>
                        <div className="flex items-center cursor-pointer">Age {renderSortIcon("age_days")}</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokenData.tokens.map((token) => (
                      <TableRow
                        key={token.id}
                        className={`hover:bg-[#2d5a4f]/50 border-[#2d5a4f] ${getRowAnimationClasses(token.id)}`}
                      >
                        <TableCell className={`font-medium w-[160px] ${getCellAnimationClasses(token.id, "symbol")}`}>
                          <div className="flex items-center gap-3">
                            {/* Token Image with Fallback */}
                            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#2d5a4f] border border-[#51d2c1]/30 overflow-hidden flex-shrink-0">
                              {token.image_url && token.image_url.trim() !== "" ? (
                                <img
                                  src={token.image_url || "/placeholder.svg"}
                                  alt={token.symbol || "Token"}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Replace with placeholder on error
                                    const img = e.currentTarget as HTMLImageElement
                                    img.style.display = "none"
                                    const placeholder = img.nextElementSibling as HTMLElement
                                    if (placeholder) placeholder.style.display = "flex"
                                  }}
                                />
                              ) : null}
                              <div
                                className={`w-full h-full flex items-center justify-center text-xs font-bold text-[#51d2c1] ${token.image_url && token.image_url.trim() !== "" ? "hidden" : "flex"}`}
                                style={{ display: token.image_url && token.image_url.trim() !== "" ? "none" : "flex" }}
                              >
                                {token?.symbol && typeof token.symbol === "string" && token.symbol.length > 0
                                  ? token.symbol.charAt(0).toUpperCase()
                                  : "?"}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <a
                                href={`https://dexscreener.com/hyperevm/${token.contract_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white font-medium truncate hover:text-[#51d2c1] transition-colors flex items-center gap-1 group"
                                title={token.symbol && typeof token.symbol === "string" ? token.symbol : "Unknown"}
                              >
                                <span className="truncate">{token.symbol || "Unknown"}</span>
                                <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:text-[#51d2c1] transition-all flex-shrink-0" />
                              </a>
                              {/* Clickable Contract Address Line */}
                              <div
                                className="text-xs text-[#868d8f] flex items-center gap-1 cursor-pointer hover:text-[#51d2c1] transition-colors group truncate"
                                onClick={(e) => copyToClipboard(token.contract_address, e)}
                                title={`Click to copy: ${token.contract_address}`}
                              >
                                <span className="group-hover:text-[#51d2c1] truncate">
                                  {token.contract_address.slice(0, 3)}...{token.contract_address.slice(-3)}
                                </span>
                                <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:text-[#51d2c1] transition-all flex-shrink-0" />
                              </div>
                              {/* Social Links */}
                              <div className="text-xs text-[#868d8f] flex items-center gap-2">
                                {(() => {
                                  // Combine social links and websites
                                  const allLinks = [
                                    ...(token.socials || []).map((social: any) => ({
                                      url: social.url,
                                      platform: social.platform,
                                      type: "social",
                                    })),
                                    ...(token.websites || []).map((website: any) => ({
                                      url: website.url,
                                      platform: "website",
                                      type: "website",
                                    })),
                                  ]

                                  return allLinks.length > 0 ? (
                                    allLinks.slice(0, 3).map((link: any, index: number) => (
                                      <a
                                        key={index}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-[#51d2c1] transition-colors"
                                        title={`${link?.platform && typeof link.platform === "string" && link.platform.length > 0 ? link.platform.charAt(0).toUpperCase() + link.platform.slice(1) : "Link"}`}
                                      >
                                        {link?.platform === "twitter" && (
                                          <img src="/icons/twitter-x-24.png" alt="Twitter" className="h-3 w-3" />
                                        )}
                                        {link?.platform === "telegram" && (
                                          <img src="/icons/telegram-24.png" alt="Telegram" className="h-3 w-3" />
                                        )}
                                        {link?.platform === "discord" && (
                                          <img src="/icons/discord-24.png" alt="Discord" className="h-3 w-3" />
                                        )}
                                        {link?.platform === "website" && (
                                          <img src="/icons/geography-24.png" alt="Website" className="h-3 w-3" />
                                        )}
                                      </a>
                                    ))
                                  ) : (
                                    <span className="opacity-60">—</span>
                                  )
                                })()}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <div className="flex flex-col gap-1">
                            {/* Green button with logo and text */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-md w-full flex items-center justify-between gap-1"
                              onClick={() =>
                                window.open(
                                  `https://app.hyperswap.exchange/#/swap?outputCurrency=${token.contract_address}`,
                                  "_blank",
                                )
                              }
                            >
                              <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-white">
                                  <img
                                    src="https://dropjet.co/wp-content/uploads/2024/10/HyperSwap-Logo.jpg"
                                    alt="HyperSwap"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="truncate">Hyperswap</span>
                              </div>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Button>

                            {/* Purple button with logo and text */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-md w-full flex items-center justify-between gap-1"
                              onClick={() =>
                                window.open(
                                  `https://t.me/maestro?start=${token.contract_address}-anonymiceagen`,
                                  "_blank",
                                )
                              }
                            >
                              <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-white">
                                  <img
                                    src="https://pbs.twimg.com/profile_images/1897708570919010304/6i1yPLMe_400x400.jpg"
                                    alt="Maestro"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="truncate">Maestro</span>
                              </div>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-white font-mono w-[100px] truncate ${getCellAnimationClasses(token.id, "price_usd")}`}
                          title={formatPrice(token.price_usd)}
                        >
                          {formatPrice(token.price_usd)}
                        </TableCell>
                        <TableCell
                          className={`text-white font-mono w-[150px] truncate ${getCellAnimationClasses(token.id, "market_cap")}`}
                          title={formatTVL(token.market_cap)}
                        >
                          {formatTVL(token.market_cap)}
                        </TableCell>
                        <TableCell className={`w-[80px] ${getCellAnimationClasses(token.id, "price_change_30m")}`}>
                          <Badge
                            variant="outline"
                            className={`font-mono ${
                              (token.price_change_30m || 0) >= 0
                                ? "text-[#20a67d] border-[#20a67d] bg-[#20a67d]/10"
                                : "text-[#ed7188] border-[#ed7188] bg-[#ed7188]/10"
                            }`}
                          >
                            {formatPercentage(token.price_change_30m)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`w-[80px] ${getCellAnimationClasses(token.id, "price_change_24h")}`}>
                          <Badge
                            variant="outline"
                            className={`font-mono ${
                              (token.price_change_24h || 0) >= 0
                                ? "text-[#20a67d] border-[#20a67d] bg-[#20a67d]/10"
                                : "text-[#ed7188] border-[#ed7188] bg-[#ed7188]/10"
                            }`}
                          >
                            {formatPercentage(token.price_change_24h)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-white font-mono w-[140px] truncate ${getCellAnimationClasses(token.id, "volume_24h")}`}
                          title={formatTVL(token.volume_24h)}
                        >
                          {formatTVL(token.volume_24h)}
                        </TableCell>
                        <TableCell
                          className={`text-white font-mono w-[140px] truncate ${getCellAnimationClasses(token.id, "liquidity_usd")}`}
                          title={formatTVL(token.liquidity_usd)}
                        >
                          {formatTVL(token.liquidity_usd)}
                        </TableCell>
                        <TableCell className="text-[#868d8f] w-[80px]">{formatAge(token.pair_created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls - Desktop Only */}
              {totalPages > 1 ? (
                <div className="hidden md:flex items-center justify-between mt-6">
                  <div className="flex items-center gap-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0f1a1f] border border-[#51d2c1]/30 text-[#51d2c1] shadow-lg backdrop-blur-sm">
                      <div className="flex items-center gap-1">
                        {isRefreshing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Refreshing...</span>
                          </>
                        ) : (
                          <span>Updates every minute</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className={`w-8 h-8 p-0 rounded-md ${
                              currentPage === pageNum
                                ? "bg-[#51d2c1] text-black border-[#51d2c1]"
                                : "bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="hidden md:flex items-center justify-between mt-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0f1a1f] border border-[#51d2c1]/30 text-[#51d2c1] shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-1">
                      {isRefreshing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Refreshing...</span>
                        </>
                      ) : (
                        <span>Updates every minute</span>
                      )}
                    </div>
                  </div>
                  <div></div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Layout - Clean Cards */}
          <div className="block md:hidden">
            <div className="space-y-3">
              {tokenData?.tokens?.map((token) => (
                <div
                  key={token.id}
                  className={`bg-[#0f1a1f] border border-[#2d5a4f] rounded-lg p-4 ${getRowAnimationClasses(token.id)}`}
                >
                  {/* Row 1: Token Info - Full Width for Name */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Token Icon with Fallback */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2d5a4f] border border-[#51d2c1]/30 overflow-hidden flex-shrink-0">
                      {token.image_url && token.image_url.trim() !== "" ? (
                        <img
                          src={token.image_url || "/placeholder.svg"}
                          alt={token.symbol || "Token"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = "none"
                            const placeholder = img.nextElementSibling as HTMLElement
                            if (placeholder) placeholder.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center text-sm font-bold text-[#51d2c1] ${token.image_url && token.image_url.trim() !== "" ? "hidden" : "flex"}`}
                        style={{ display: token.image_url && token.image_url.trim() !== "" ? "none" : "flex" }}
                      >
                        {token?.symbol && typeof token.symbol === "string" && token.symbol.length > 0
                          ? token.symbol.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://dexscreener.com/hyperevm/${token.contract_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white font-semibold text-lg hover:text-[#51d2c1] transition-colors flex items-center gap-2 group"
                        title={token.symbol && typeof token.symbol === "string" ? token.symbol : "Unknown"}
                      >
                        <span className="break-words">{token.symbol || "Unknown"}</span>
                        <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100 group-hover:text-[#51d2c1] transition-all flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Row 1.5: Price + Performance */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`text-white font-mono text-sm font-semibold ${getCellAnimationClasses(token.id, "price_usd")}`}
                      title={formatPrice(token.price_usd)}
                    >
                      {formatPrice(token.price_usd)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          (token.price_change_30m || 0) >= 0
                            ? "text-[#20a67d] bg-[#20a67d]/10"
                            : "text-[#ed7188] bg-[#ed7188]/10"
                        }`}
                      >
                        1H {formatPercentage(token.price_change_30m)}
                      </div>
                      <div
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          (token.price_change_24h || 0) >= 0
                            ? "text-[#20a67d] bg-[#20a67d]/10"
                            : "text-[#ed7188] bg-[#ed7188]/10"
                        }`}
                      >
                        24H {formatPercentage(token.price_change_24h)}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Contract Address + Metrics - Improved Mobile Layout */}
                  <div className="flex flex-col space-y-2 mb-3">
                    {/* Top row: Contract Address + Social Links */}
                    <div className="flex items-center justify-between">
                      {/* Left: Contract Address */}
                      <div
                        className="text-[10px] text-[#868d8f] flex items-center gap-2 cursor-pointer hover:text-[#51d2c1] transition-colors group"
                        onClick={(e) => copyToClipboard(token.contract_address, e)}
                        title={`Click to copy: ${token.contract_address}`}
                      >
                        <span className="group-hover:text-[#51d2c1]">
                          {token.contract_address.slice(0, 3)}...{token.contract_address.slice(-3)}
                        </span>
                        <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:text-[#51d2c1] transition-all" />
                      </div>

                      {/* Right: Social Links */}
                      <div className="text-xs text-[#868d8f] flex items-center gap-2">
                        {(() => {
                          // Combine social links and websites
                          const allLinks = [
                            ...(token.socials || []).map((social: any) => ({
                              url: social.url,
                              platform: social.platform,
                              type: "social",
                            })),
                            ...(token.websites || []).map((website: any) => ({
                              url: website.url,
                              platform: "website",
                              type: "website",
                            })),
                          ]

                          return allLinks.length > 0 ? (
                            allLinks.slice(0, 3).map((link: any, index: number) => (
                              <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#51d2c1] transition-colors"
                                title={`${link?.platform && typeof link.platform === "string" && link.platform.length > 0 ? link.platform.charAt(0).toUpperCase() + link.platform.slice(1) : "Link"}`}
                              >
                                {link?.platform === "twitter" && (
                                  <img src="/icons/twitter-x-24.png" alt="Twitter" className="h-3 w-3" />
                                )}
                                {link?.platform === "telegram" && (
                                  <img src="/icons/telegram-24.png" alt="Telegram" className="h-4 w-4" />
                                )}
                                {link?.platform === "discord" && (
                                  <img src="/icons/discord-24.png" alt="Discord" className="h-4 w-4" />
                                )}
                                {link?.platform === "website" && (
                                  <img src="/icons/geography-24.png" alt="Website" className="h-4 w-4" />
                                )}
                              </a>
                            ))
                          ) : (
                            <span className="opacity-60">—</span>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Bottom row: Key Metrics */}
                    <div className="flex items-center justify-between text-[10px] text-[#868d8f]">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#2d5a4f]/50 px-2 py-0.5 rounded-full">
                          VOL {formatTVL(token.volume_24h)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#2d5a4f]/50 px-2 py-0.5 rounded-full">
                          MCAP {formatTVL(token.market_cap)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Trade Buttons */}
                  <div className="space-y-2">
                    {/* Hyperswap button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-4 text-xs bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-lg w-full flex items-center justify-between"
                      onClick={() =>
                        window.open(
                          `https://app.hyperswap.exchange/#/swap?outputCurrency=${token.contract_address}`,
                          "_blank",
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white">
                          <img
                            src="https://dropjet.co/wp-content/uploads/2024/10/HyperSwap-Logo.jpg"
                            alt="HyperSwap"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-medium">Hyperswap</span>
                      </div>
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    </Button>

                    {/* Maestro button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-4 text-xs bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-lg w-full flex items-center justify-between"
                      onClick={() =>
                        window.open(`https://t.me/maestro?start=${token.contract_address}-anonymiceagen`, "_blank")
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white">
                          <img
                            src="https://pbs.twimg.com/profile_images/1897708570919010304/6i1yPLMe_400x400.jpg"
                            alt="Maestro"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-medium">Maestro</span>
                      </div>
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex md:hidden items-center justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>

              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer - Made by pill */}
      <div className="flex justify-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#0f1a1f] border border-[#868d8f]/30 text-[#868d8f] shadow-lg backdrop-blur-sm cursor-pointer hover:border-[#51d2c1]/50 hover:text-[#51d2c1] transition-colors"
          onClick={() => window.open("https://app.hyperliquid.xyz/join/ATAREH", "_blank")}
        >
          <span>Join Hyperliquid</span>
        </div>
      </div>

      {/* Toast */}
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
