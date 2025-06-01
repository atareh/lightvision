"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useHyperEVMData } from "@/hooks/use-hyperevm-data"
import { useTokenData } from "@/hooks/use-token-data"
import { ArrowUpDown } from "lucide-react"
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
      <div className="flex gap-6">
        {/* HyperEVM TVL Chart - Full Height on Left */}
        <Card className="flex-1 min-w-0 lg:h-[528px] bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden">
          <CardContent className="px-4 py-2 h-full flex flex-col">
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
              <div className="flex flex-col h-full">
                {/* SVG Chart - Now fills all available space */}
                <div className="flex-1">
                  <HyperEVMChart />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right side metrics - 4 cards stacked */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:flex-col lg:justify-between lg:w-[200px] lg:h-[528px] lg:gap-0">
          {/* HyperEVM TVL Value Card */}
          <Card className="w-full bg-[#0f1a1f] rounded-xl border border-[#1a2e2a] shadow-lg overflow-hidden transition-all duration-300 hover:bg-[#132824] hover:border-[#20a67d50] relative before:absolute before:inset-0.5 before:rounded-lg before:border border-[#20a67d] before:pointer-events-none">
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
    </div>
  )
}
