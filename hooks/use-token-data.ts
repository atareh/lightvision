"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface Token {
  id: string
  contract_address: string
  name: string | null
  symbol: string | null
  image_url: string | null
  pair_created_at: string | null // For age_days calculation
  token_updated_at: string | null // Timestamp from 'tokens' table

  price_usd: number | null
  market_cap: number | null
  fdv: number | null
  volume_24h: number | null
  liquidity_usd: number | null
  price_change_30m: number | null
  price_change_24h: number | null
  metrics_recorded_at: string | null // Timestamp from 'token_metrics' table

  age_days: number | null // Calculated on the client or server, but part of the final object
}

interface TokenData {
  tokens: Token[]
  count: number
  totalCount: number
  page: number
  totalPages: number
  hasMore: boolean
  last_updated: string
  // Add totals for all tokens, not just current page
  totalMarketCap: number
  totalVolume24h: number
  message?: string
  error?: string
  searchTerm?: string
  filteredCount?: number
}

interface TokenDiff {
  tokenId: string
  changes: {
    field: keyof Token
    oldValue: any
    newValue: any
    isNumeric: boolean
    isPositive?: boolean
  }[]
}

export function useTokenData() {
  const [data, setData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<TokenDiff[]>([])
  const [updatingTokens, setUpdatingTokens] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allTokensCache, setAllTokensCache] = useState<Token[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [searchTerm, setSearchTerm] = useState("")

  // Use refs to avoid dependency cycles
  const dataRef = useRef<TokenData | null>(null)
  const currentPageRef = useRef(1)
  const sortColumnRef = useRef<string | null>(null)
  const sortDirectionRef = useRef<"asc" | "desc">("desc")
  const searchTermRef = useRef("")

  // Update refs whenever state changes
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    sortColumnRef.current = sortColumn
  }, [sortColumn])

  useEffect(() => {
    sortDirectionRef.current = sortDirection
  }, [sortDirection])

  useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])

  const computeDiff = useCallback((oldTokens: Token[], newTokens: Token[]): TokenDiff[] => {
    const diffs: TokenDiff[] = []
    const oldTokenMap = new Map(oldTokens.map((token) => [token.id, token]))

    for (const newToken of newTokens) {
      const oldToken = oldTokenMap.get(newToken.id)
      if (!oldToken) continue // Skip new tokens for now

      const changes: TokenDiff["changes"] = []

      // Check numeric fields that we want to animate
      const numericFields: (keyof Token)[] = [
        "price_usd",
        "market_cap",
        "fdv",
        "price_change_30m",
        "price_change_24h",
        "volume_24h",
        "liquidity_usd",
      ]

      for (const field of numericFields) {
        const oldValue = oldToken[field]
        const newValue = newToken[field]

        if (oldValue !== newValue) {
          const isPositive =
            typeof newValue === "number" && typeof oldValue === "number" ? newValue > oldValue : undefined

          changes.push({
            field,
            oldValue,
            newValue,
            isNumeric: true,
            isPositive,
          })
        }
      }

      // Check non-numeric fields
      const otherFields: (keyof Token)[] = ["name", "symbol", "image_url"]
      for (const field of otherFields) {
        if (oldToken[field] !== newToken[field]) {
          changes.push({
            field,
            oldValue: oldToken[field],
            newValue: newToken[field],
            isNumeric: false,
          })
        }
      }

      if (changes.length > 0) {
        diffs.push({
          tokenId: newToken.id,
          changes,
        })
      }
    }

    return diffs
  }, [])

  const applyUpdatesWithAnimation = useCallback((diffs: TokenDiff[], newData: TokenData) => {
    if (diffs.length === 0) {
      // No changes, just update data
      setData(newData)
      return
    }

    console.log(`🎬 Applying ${diffs.length} animated updates`)

    // Set pending updates for animation
    setPendingUpdates(diffs)

    // Immediately update with new data to maintain correct pagination
    setData(newData)

    // Stagger the animation highlights
    diffs.forEach((diff, index) => {
      setTimeout(() => {
        setUpdatingTokens((prev) => new Set([...prev, diff.tokenId]))

        // Remove from updating set after animation completes
        setTimeout(() => {
          setUpdatingTokens((prev) => {
            const newSet = new Set(prev)
            newSet.delete(diff.tokenId)
            return newSet
          })
        }, 1000) // Animation duration
      }, index * 50) // Stagger by 50ms per row
    })

    // Clear pending updates after all animations start
    setTimeout(
      () => {
        setPendingUpdates([])
      },
      diffs.length * 50 + 500,
    )
  }, [])

  // Filter tokens based on search term
  const filterTokens = useCallback((tokens: Token[]): Token[] => {
    if (!searchTermRef.current.trim()) return tokens

    const searchLower = searchTermRef.current.toLowerCase().trim()

    // Sequential character matching function
    const sequentialMatch = (text: string, search: string): boolean => {
      if (!text || !search) return false

      const textLower = text.toLowerCase()
      let searchIndex = 0

      for (let i = 0; i < textLower.length && searchIndex < search.length; i++) {
        if (textLower[i] === search[searchIndex]) {
          searchIndex++
        }
      }

      return searchIndex === search.length
    }

    return tokens.filter((token) => {
      // Search by contract address (EXACT match only, not partial)
      const contractMatch = token.contract_address.toLowerCase() === searchLower

      // Search by token symbol (sequential character matching)
      const symbolMatch = token.symbol ? sequentialMatch(token.symbol, searchLower) : false

      // Search by token name (sequential character matching)
      const nameMatch = token.name ? sequentialMatch(token.name, searchLower) : false

      return contractMatch || symbolMatch || nameMatch
    })
  }, [])

  // Sort tokens based on current sort settings
  const sortTokens = useCallback((tokens: Token[]): Token[] => {
    if (!sortColumnRef.current) return tokens

    return [...tokens].sort((a, b) => {
      const aVal = a[sortColumnRef.current as keyof Token]
      const bVal = b[sortColumnRef.current as keyof Token]

      // Handle null values
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      // Convert to numbers for numeric columns
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirectionRef.current === "asc" ? aVal - bVal : bVal - aVal
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()

      if (sortDirectionRef.current === "asc") {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
      }
    })
  }, [])

  // Calculate paginated data from cache
  const getPaginatedData = useCallback(
    (page: number, allTokens: Token[]): TokenData => {
      // First filter the tokens based on search
      const filteredTokens = filterTokens(allTokens)

      // Then sort the filtered tokens
      const sortedTokens = sortTokens(filteredTokens)

      const tokensPerPage = 10
      const totalPages = Math.ceil(sortedTokens.length / tokensPerPage)

      // Ensure page is within valid bounds
      const validPage = Math.max(1, Math.min(page, totalPages || 1))

      const startIndex = (validPage - 1) * tokensPerPage
      const endIndex = startIndex + tokensPerPage
      const paginatedTokens = sortedTokens.slice(startIndex, endIndex)

      // Calculate totals for ALL tokens (not filtered), not just current page
      const totalMarketCap = allTokens.reduce((sum, token) => sum + (token.market_cap || 0), 0)
      const totalVolume24h = allTokens.reduce((sum, token) => sum + (token.volume_24h || 0), 0)

      return {
        tokens: paginatedTokens,
        count: paginatedTokens.length,
        totalCount: sortedTokens.length,
        page: validPage,
        totalPages: totalPages || 1,
        hasMore: validPage < (totalPages || 1),
        totalMarketCap,
        totalVolume24h,
        last_updated: new Date().toISOString(),
        searchTerm: searchTermRef.current,
        filteredCount: sortedTokens.length,
      }
    },
    [filterTokens, sortTokens],
  )

  // Fetch data for a specific page
  const fetchData = useCallback(
    async (page: number, isInitialLoad = false) => {
      try {
        console.log(`🔍 useTokenData: Fetching page ${page}...`, { isInitialLoad })

        if (isInitialLoad) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }

        setError(null)

        // For initial load, get all tokens and cache them
        // For page changes, use cached data if available
        if (isInitialLoad || allTokensCache.length === 0) {
          console.log("🚀 Fetching all tokens for caching...")
          const response = await fetch("/api/tokens") // Get all tokens

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch token data`)
          }

          const result = await response.json()

          if (result.error) {
            setError(result.error)
            setData({
              tokens: [],
              count: 0,
              totalCount: 0,
              page: 1,
              totalPages: 0,
              hasMore: false,
              totalMarketCap: 0,
              totalVolume24h: 0,
              last_updated: new Date().toISOString(),
              error: result.error,
            })
            return
          }

          // Cache all tokens (already sorted by market cap from API)
          setAllTokensCache(result.tokens)

          // Return paginated data
          const paginatedData = getPaginatedData(page, result.tokens)
          console.log(`✅ Initial load complete: ${paginatedData.count} tokens on page ${page}`)
          setData(paginatedData)
        } else {
          // Use cached data for pagination
          console.log("📄 Using cached data for pagination...")
          const paginatedData = getPaginatedData(page, allTokensCache)
          console.log(`✅ Page ${page} loaded from cache: ${paginatedData.count} tokens`)
          setData(paginatedData)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        console.error("Error fetching token data:", err)

        if (isInitialLoad) {
          setData({
            tokens: [],
            count: 0,
            totalCount: 0,
            page: 1,
            totalPages: 0,
            hasMore: false,
            totalMarketCap: 0,
            totalVolume24h: 0,
            last_updated: new Date().toISOString(),
          })
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false)
        } else {
          setIsRefreshing(false)
        }
      }
    },
    [allTokensCache, getPaginatedData],
  )

  // Periodic refresh - refresh all data but PRESERVE current page and search
  const refreshData = useCallback(async () => {
    try {
      console.log("🔄 useTokenData: Periodic refresh...")
      setIsRefreshing(true)

      const response = await fetch("/api/tokens") // Get all tokens

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to refresh token data`)
      }

      const result = await response.json()

      if (!result.error) {
        // Update cache
        setAllTokensCache(result.tokens)

        // Validate current page is still valid for new dataset (with current search/filter)
        const filteredTokens = filterTokens(result.tokens)
        const tokensPerPage = 10
        const newTotalPages = Math.ceil(filteredTokens.length / tokensPerPage)
        let validPage = currentPageRef.current

        // If current page is now out of bounds, reset to page 1
        if (currentPageRef.current > newTotalPages) {
          validPage = 1
          setCurrentPage(1)
          console.log(`📄 Page ${currentPageRef.current} out of bounds, resetting to page 1`)
        }

        // Update current page data with validated page number
        // Make sure we're using the current sort settings and search
        const paginatedData = getPaginatedData(validPage, result.tokens)

        // Check for changes and animate
        const currentData = dataRef.current
        if (currentData?.tokens && currentData.tokens.length > 0) {
          const diffs = computeDiff(currentData.tokens, paginatedData.tokens)
          console.log(`🔍 Refresh: Found ${diffs.length} changes to animate`)
          applyUpdatesWithAnimation(diffs, paginatedData)
        } else {
          setData(paginatedData)
        }
      }
    } catch (err) {
      console.error("Error refreshing token data:", err)
      // Don't set error state for refresh failures
    } finally {
      setIsRefreshing(false)
    }
  }, [computeDiff, applyUpdatesWithAnimation, getPaginatedData, filterTokens])

  // Page change function
  const goToPage = useCallback(
    (page: number) => {
      if (allTokensCache.length > 0) {
        const filteredTokens = filterTokens(allTokensCache)
        const totalPages = Math.ceil(filteredTokens.length / 10)
        const validPage = Math.max(1, Math.min(page, totalPages))
        setCurrentPage(validPage)

        // Update data immediately from cache
        const paginatedData = getPaginatedData(validPage, allTokensCache)
        setData(paginatedData)
      }
    },
    [allTokensCache, getPaginatedData, filterTokens],
  )

  // Set sort function
  const setSort = useCallback(
    (column: string, direction: "asc" | "desc") => {
      console.log(`🔄 Setting sort: ${column} ${direction}`)
      setSortColumn(column)
      setSortDirection(direction)

      // Update refs immediately to ensure they're current for any async operations
      sortColumnRef.current = column
      sortDirectionRef.current = direction

      // If we have cached data, apply the sort immediately
      if (allTokensCache.length > 0) {
        const paginatedData = getPaginatedData(currentPageRef.current, allTokensCache)
        setData(paginatedData)
      }
    },
    [allTokensCache, getPaginatedData],
  )

  // Search function
  const setSearch = useCallback(
    (term: string) => {
      console.log(`🔍 Setting search: "${term}"`)
      setSearchTerm(term)
      searchTermRef.current = term

      // Reset to page 1 when searching
      setCurrentPage(1)
      currentPageRef.current = 1

      // If we have cached data, apply the search immediately
      if (allTokensCache.length > 0) {
        const paginatedData = getPaginatedData(1, allTokensCache)
        setData(paginatedData)
      }
    },
    [allTokensCache, getPaginatedData],
  )

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearch("")
  }, [setSearch])

  // Effect for initial load
  useEffect(() => {
    console.log("🔍 useTokenData: Initial setup")
    fetchData(1, true)

    // Set up interval for periodic refresh (1 minute)
    const interval = setInterval(refreshData, 1 * 60 * 1000)

    return () => {
      console.log("🧹 useTokenData: Cleaning up interval")
      clearInterval(interval)
    }
  }, []) // Only run once on mount

  return {
    data,
    loading,
    error,
    pendingUpdates,
    updatingTokens,
    isRefreshing,
    currentPage,
    sortColumn,
    sortDirection,
    searchTerm,
    allTokensCache, // Add this line
    goToPage,
    setSort,
    setSearch,
    clearSearch,
    // Helper function to get changes for a specific token.
    getTokenChanges: useCallback(
      (tokenId: string) => {
        return pendingUpdates.find((update) => update.tokenId === tokenId)?.changes || []
      },
      [pendingUpdates],
    ),
  }
}
