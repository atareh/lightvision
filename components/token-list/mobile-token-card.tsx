"use client"

import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Copy } from "lucide-react"
import { cn } from "@/lib/utils"

// This Token interface should ideally be imported from where your useTokenData hook defines it.
// If not available for import, this local definition should match the structure.
interface Token {
  id: string
  name: string
  symbol: string
  contract_address: string
  price_usd: number | null
  market_cap_usd: number | null
  fdv_usd?: number | null // Fully Diluted Valuation, often used as fallback for market cap
  volume_24h_usd: number | null
  price_change_24h_usd_percent: number | null
  logo_url?: string | null
  // Add any other fields from your actual Token type that might be useful
}

interface MobileTokenCardProps {
  token: Token
  formatPrice: (price: number | null | undefined) => string
  formatTVL: (value: number | null | undefined) => string // Used for market cap, volume
  formatPercentageChange: (percentage: number | null | undefined) => string
  copyToClipboard: (text: string, event: React.MouseEvent, message?: string) => Promise<void>
  // These are passed but not used in this simplified version; could be added for animations
  // getCellAnimationClasses: (tokenId: string, field: string) => string;
  // getRowAnimationClasses: (tokenId: string) => string;
}

const MobileTokenCard: React.FC<MobileTokenCardProps> = ({
  token,
  formatPrice,
  formatTVL,
  formatPercentageChange,
  copyToClipboard,
}) => {
  const handleCopyToClipboard = (text: string, e: React.MouseEvent) => {
    copyToClipboard(text, e, `${token.symbol} address copied!`)
  }

  // Determine the value for market cap, preferring market_cap_usd, then fdv_usd
  const marketCapDisplayValue = token.market_cap_usd ?? token.fdv_usd

  return (
    <div className="bg-[#132029] border border-[#2d5a4f]/50 rounded-lg shadow-md p-4 mb-3 text-white">
      {/* Header: Name, Symbol, Logo, 24h Change Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {token.logo_url ? (
            <img
              src={token.logo_url || "/placeholder.svg"}
              alt={`${token.name} logo`}
              className="w-8 h-8 rounded-full object-contain bg-gray-700" // Added bg for transparency handling
              onError={(e) => (e.currentTarget.style.display = "none")} // Hide if image fails to load
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
              {token.symbol.substring(0, 1)}
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold leading-tight">{token.name}</h3>
            <p className="text-xs text-gray-400 leading-tight">{token.symbol}</p>
          </div>
        </div>
        {token.price_change_24h_usd_percent !== null && token.price_change_24h_usd_percent !== undefined && (
          <Badge
            className={cn(
              "text-xs px-1.5 py-0.5 font-mono",
              token.price_change_24h_usd_percent >= 0
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30",
            )}
          >
            {formatPercentageChange(token.price_change_24h_usd_percent / 100)}
          </Badge>
        )}
      </div>

      {/* Main Info: Price */}
      <div className="mb-4">
        <p className="text-xs text-gray-400">Price</p>
        <p className="text-xl font-semibold font-teodor tracking-tight">{formatPrice(token.price_usd)}</p>
      </div>

      {/* Details: Market Cap & Volume */}
      <div className="grid grid-cols-2 gap-4 text-xs mb-4">
        <div>
          <p className="text-gray-400 mb-0.5">Market Cap</p>
          <p className="font-medium text-sm">{formatTVL(marketCapDisplayValue)}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-0.5">Volume (24h)</p>
          <p className="font-medium text-sm">{formatTVL(token.volume_24h_usd)}</p>
        </div>
      </div>

      {/* Contract Address with Copy */}
      {token.contract_address && (
        <div className="text-xs border-t border-[#2d5a4f]/50 pt-3">
          <p className="text-gray-400 mb-1">Contract Address</p>
          <button
            onClick={(e) => handleCopyToClipboard(token.contract_address, e)}
            className="flex items-center space-x-1.5 text-gray-300 hover:text-[#51d2c1] transition-colors w-full text-left group"
            title="Copy contract address"
          >
            <Copy className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 group-hover:text-[#51d2c1]" />
            <span className="truncate flex-1 font-mono">{token.contract_address}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default MobileTokenCard
