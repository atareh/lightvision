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
export function abbreviateNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined) return "—"

  const absValue = Math.abs(value)

  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`
  } else {
    return value.toFixed(decimals)
  }
}

/**
 * Formats a number as currency (USD)
 * @param value The number to format as currency
 * @param minimumFractionDigits Minimum decimal places (default: 2)
 * @param maximumFractionDigits Maximum decimal places (default: 2)
 * @returns The formatted currency string
 */
export function formatCurrency(value: number, minimumFractionDigits = 2, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "—"

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
export function formatNumber(value: number, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) return "—"

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formats a number as a percentage
 * @param value The number to format as percentage (e.g., 0.15 for 15%)
 * @param decimals The number of decimal places to show
 * @returns The formatted percentage string
 */
export function formatPercentage(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "—"

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
