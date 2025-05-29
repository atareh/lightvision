import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function abbreviateNumber(value: number): string {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(1) + "B"
  } else if (value >= 1e6) {
    return (value / 1e6).toFixed(1) + "M"
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(1) + "K"
  } else {
    return value.toString()
  }
}
