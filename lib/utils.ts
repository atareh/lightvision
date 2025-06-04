import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Abbreviates a number to a more readable format (e.g., 1000 -> 1K, 1000000 -> 1M)
 * @param value The number to abbreviate
 * @param decimals The number of decimal places to show
 * @returns The abbreviated number as a string
 */
export function abbreviateNumber(value: number | null | undefined, decimals = 2, defaultValue = "—"): string {
  if (value === null || value === undefined || isNaN(value)) return defaultValue

  const absValue = Math.abs(value)

  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`
  } else {
    // For numbers less than 1000, decide if we want to show decimals based on original value
    // For simplicity here, using the provided decimals, but could be conditional
    return value.toFixed(value % 1 !== 0 ? decimals : 0)
  }
}

/**
 * Formats a number as currency (USD)
 * @param value The number to format as currency
 * @param minimumFractionDigits Minimum decimal places (default: 2)
 * @param maximumFractionDigits Maximum decimal places (default: 2)
 * @returns The formatted currency string
 */
export function formatCurrency(
  value: number | null | undefined,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  defaultValue = "—",
): string {
  if (value === null || value === undefined || isNaN(value)) return defaultValue

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

/**
 * Formats a number with commas as thousand separators
 * @param value The number to format
 * @param decimals The number of decimal places to show
 * @returns The formatted number as a string
 */
export function formatNumber(value: number | null | undefined, decimals = 0, defaultValue = "—"): string {
  if (value === null || value === undefined || isNaN(value)) return defaultValue

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formats a number as a general percentage.
 * @param value The number to format as percentage (e.g., 0.15 for 15%)
 * @param decimals The number of decimal places to show
 * @returns The formatted percentage string
 */
export function formatPercentage(value: number | null | undefined, decimals = 2, defaultValue = "—"): string {
  if (value === null || value === undefined || isNaN(value)) return defaultValue

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Specific formatters for the application, consolidated here

export const formatTVL = (tvl: number | null | undefined, defaultValue = "TO DO"): string => {
  if (tvl === null || tvl === undefined || tvl === 0) return defaultValue
  const absTvl = Math.abs(tvl)
  if (absTvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
  if (absTvl >= 100e6) return `$${Math.round(tvl / 1e6)}M`
  if (absTvl >= 10e6) return `$${(tvl / 1e6).toFixed(1)}M`
  if (absTvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
  if (absTvl >= 100e3) return `$${Math.round(tvl / 1e3)}K`
  if (absTvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`
  return `$${tvl.toFixed(2)}`
}

export const formatPrice = (price: number | null | undefined, defaultValue = "—"): string => {
  if (price === null || price === undefined) return defaultValue
  if (price === 0) return "$0.00"

  if (price < 0.001 && price !== 0) {
    const str = price.toFixed(10) // Ensure enough precision for small numbers
    const match = str.match(/^0\.0*/)
    if (match) {
      const leadingZeros = match[0].length - 2
      if (leadingZeros >= 3) {
        const significantDigits = str.slice(match[0].length, match[0].length + 2)
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
  if (price < 1 && price !== 0) return `$${price.toFixed(3)}` // Up to 3 decimals for < $1
  if (price < 1000) return `$${price.toFixed(2)}` // 2 decimals for $1-$999
  if (price < 1000000) return `$${(price / 1000).toFixed(1)}K` // $XK.X
  return `$${(price / 1000000).toFixed(1)}M` // $XM.X
}

/**
 * Formats a number as a percentage change, with sign and compact representation.
 * @param value The number to format as percentage change (e.g., 0.15 for +15%)
 * @returns The formatted percentage string
 */
export const formatPercentageChange = (value: number | null | undefined, defaultValue = "—"): string => {
  if (value === null || value === undefined) return defaultValue
  const absValue = Math.abs(value)
  const sign = value >= 0 ? "+" : "" // Keep sign for 0 as well, e.g. +0.00%

  if (absValue >= 1000) {
    // e.g. +1234.5% -> +1.2K%
    const kValue = value / 1000
    const oneDecimal = `${sign}${kValue.toFixed(1)}K%`
    if (oneDecimal.length <= 7) return oneDecimal // Allow a bit more length for K values
    return `${sign}${Math.round(kValue)}K%`
  }
  if (absValue >= 100) {
    // e.g. +123.45% -> +123%
    return `${sign}${Math.round(value)}%`
  }
  // For smaller numbers, try to fit within ~6-7 characters including sign and %
  if (absValue >= 10) {
    // e.g. +12.34% -> +12.3%
    const oneDecimal = `${sign}${value.toFixed(1)}%`
    if (oneDecimal.length <= 6) return oneDecimal
    return `${sign}${Math.round(value)}%` // If too long, round: +99.9% -> +100%
  }
  // For absValue < 10, e.g. +1.23% or +0.12%
  const twoDecimals = `${sign}${value.toFixed(2)}%`
  if (twoDecimals.length <= 7) return twoDecimals // Allow up to 7 chars like "+1.23%" or "-0.12%"

  const oneDecimalRetry = `${sign}${value.toFixed(1)}%` // e.g. +9.99% -> +10.0% (too long), try +9.9%
  if (oneDecimalRetry.length <= 7) return oneDecimalRetry

  return `${sign}${Math.round(value)}%` // Fallback: +0.1% or +0%
}

export const formatAge = (createdAt: string | null | undefined, defaultValue = "—"): string => {
  if (!createdAt) return defaultValue
  const date = new Date(createdAt)
  if (isNaN(date.getTime())) return defaultValue
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return "Future"
  if (days === 0) return "Today"
  if (days === 1) return "1 day"
  return `${days} days`
}

export const formatNetflow = (netflow: number | null | undefined, defaultValue = ""): string => {
  if (netflow === null || netflow === undefined) return defaultValue
  const absNetflow = Math.abs(netflow)
  const prefix = netflow >= 0 ? "+" : "-"
  if (absNetflow >= 1e6) return `${prefix}$${(absNetflow / 1e6).toFixed(2)}M today`
  if (absNetflow >= 1e3) return `${prefix}$${(absNetflow / 1e3).toFixed(1)}K today`
  return `${prefix}$${absNetflow.toFixed(2)} today`
}

export const formatWallets = (count: number | null | undefined, defaultValue = "TO DO"): string => {
  if (count === null || count === undefined || count === 0) return defaultValue
  return count.toLocaleString()
}

export const formatRevenue = (revenue: number | null | undefined, defaultValue = "TO DO"): string => {
  if (revenue === null || revenue === undefined || revenue === 0) return defaultValue
  const absRevenue = Math.abs(revenue)
  if (absRevenue >= 1e6) return `$${(revenue / 1e6).toFixed(2)}M`
  if (absRevenue >= 100e3) return `$${Math.round(revenue / 1e3)}K`
  if (absRevenue >= 1e3) return `$${(revenue / 1e3).toFixed(2)}K`
  return `$${revenue.toFixed(2)}`
}
