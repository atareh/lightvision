"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { cn } from "@/lib/utils"

// Use the SAME Token interface as the desktop table and useTokenData hook
interface Token {
  id: string
  contract_address: string
  name: string | null
  symbol: string | null
  price_usd: number | null
  market_cap: number | null
  fdv: number | null
  price_change_30m: number | null
  price_change_24h: number | null
  volume_24h: number | null
  liquidity_usd: number | null
  pair_address: string | null
  pair_created_at: string | null
  dex_id: string | null
  chain_id: string
  image_url: string | null
  holder_count: number | null
  last_updated_at: string
  age_days: number | null
  trade_url: string | null
  // Use the SAME structure as desktop table
  socials?: Array<{ platform: string; url: string }>
  websites?: Array<{ url: string }>
}

interface MobileTokenCardProps {
  token: Token
  formatPrice: (price: number | null | undefined) => string
  formatTVL: (value: number | null | undefined) => string
  formatPercentageChange: (percentage: number | null | undefined) => string
  copyToClipboard: (text: string, event: React.MouseEvent, message?: string) => Promise<void>
}

const HYPERSWAP_BUTTON_LOGO_URL = "https://dropjet.co/wp-content/uploads/2024/10/HyperSwap-Logo.jpg"
const MAESTRO_BUTTON_LOGO_URL =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTqNCxUnMR1tPiWDqK2aAhA2uGuETzOjdmQaA&s"

const MobileTokenCard: React.FC<MobileTokenCardProps> = ({
  token,
  formatPrice,
  formatTVL,
  formatPercentageChange,
  copyToClipboard,
}) => {
  const handleCopyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(text, e, `${token.symbol} address copied!`)
  }

  // Use the SAME field names as desktop table
  const marketCapDisplayValue = token.market_cap ?? token.fdv

  const hyperSwapTradeUrl = token.contract_address
    ? `https://app.hyperswap.exchange/#/swap?outputCurrency=${token.contract_address}`
    : null

  const maestroTradeUrl = token.contract_address
    ? `https://t.me/maestro?start=${token.contract_address}-anonymiceagen`
    : "https://t.me/maestro"

  const tokenExplorerUrl = `https://dexscreener.com/hyperevm/${token.contract_address}`

  const getPercentageBadgeClass = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "bg-gray-600 text-gray-300"
    return value >= 0 ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
  }

  // Use the SAME field name as desktop table
  const tokenLogoSrc = token.image_url || `/placeholder.svg?width=40&height=40&query=${token.symbol || "TKN"}`

  return (
    <div className="bg-[#1C2730] border border-[#2A3F4D] rounded-lg p-3 mb-3 text-gray-200">
      {/* Header: Logo, Name, Price */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <img
            src={tokenLogoSrc || "/placeholder.svg"}
            alt={`${token.name} logo`}
            className="w-6 h-6 rounded-full object-cover bg-[#2A3F4D]"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.onerror = null
              target.src = `/placeholder.svg?width=24&height=24&query=${token.symbol || "TKN"}`
            }}
          />
          <a
            href={tokenExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white hover:text-[#79F2E4] transition-colors truncate max-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            {token.name}
          </a>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-white">{formatPrice(token.price_usd)}</p>
        </div>
      </div>

      {/* Price Changes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex space-x-1">
          {token.price_change_30m !== null && token.price_change_30m !== undefined ? (
            <span
              className={cn(
                "px-2 py-1 rounded text-[8px] font-mono font-medium",
                token.price_change_30m >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400",
              )}
            >
              1H {formatPercentageChange(token.price_change_30m)}
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-[8px] font-mono font-medium bg-gray-600/20 text-gray-400">
              1H N/A
            </span>
          )}

          {token.price_change_24h !== null && token.price_change_24h !== undefined ? (
            <span
              className={cn(
                "px-2 py-1 rounded text-[8px] font-mono font-medium",
                token.price_change_24h >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400",
              )}
            >
              24H {formatPercentageChange(token.price_change_24h)}
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-[8px] font-mono font-medium bg-gray-600/20 text-gray-400">
              24H N/A
            </span>
          )}
        </div>

        {/* Social Links */}
        <div className="flex items-center space-x-1">
          {(() => {
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
            return allLinks.length > 0
              ? allLinks.slice(0, 3).map((link: any, index: number) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 bg-[#2A3F4D] hover:bg-[#3A4F5D] rounded transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={`${link?.platform && typeof link.platform === "string" && link.platform.length > 0 ? link.platform.charAt(0).toUpperCase() + link.platform.slice(1) : "Link"}`}
                  >
                    {link?.platform === "twitter" && (
                      <img src="/icons/twitter-x-24.png" alt="Twitter" className="w-2.5 h-2.5" />
                    )}
                    {link?.platform === "telegram" && (
                      <img src="/icons/telegram-24.png" alt="Telegram" className="w-2.5 h-2.5" />
                    )}
                    {link?.platform === "discord" && (
                      <img src="/icons/discord-24.png" alt="Discord" className="w-2.5 h-2.5" />
                    )}
                    {link?.platform === "website" && (
                      <img src="/icons/geography-24.png" alt="Website" className="w-2.5 h-2.5" />
                    )}
                  </a>
                ))
              : null
          })()}
        </div>
      </div>

      {/* Contract Address and Stats */}
      <div className="flex items-center justify-between mb-3 text-[10px] text-gray-400">
        <div className="flex items-center">
          {token.contract_address && (
            <>
              <span className="font-mono">
                {token.contract_address.substring(0, 4)}...
                {token.contract_address.substring(token.contract_address.length - 2)}
              </span>
              <button
                onClick={handleCopyToClipboard.bind(null, token.contract_address)}
                className="ml-1 text-gray-400 hover:text-[#79F2E4] transition-colors"
                title="Copy contract address"
              >
                <Copy className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <span className="bg-[#2A3F4D] px-1.5 py-0.5 rounded font-mono text-[8px]">
            VOL {formatTVL(token.volume_24h)}
          </span>
          <span className="bg-[#2A3F4D] px-1.5 py-0.5 rounded font-mono text-[8px]">
            MCAP {formatTVL(marketCapDisplayValue)}
          </span>
        </div>
      </div>

      {/* Trade Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {hyperSwapTradeUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 bg-[#79F2E4] text-black hover:bg-[#62D5C7] transition-colors rounded flex items-center justify-center px-2"
            onClick={(e) => {
              e.stopPropagation()
              window.open(hyperSwapTradeUrl, "_blank")
            }}
            title={`Trade ${token.symbol} on HyperSwap`}
          >
            <img
              src={HYPERSWAP_BUTTON_LOGO_URL || "/placeholder.svg"}
              alt="HyperSwap"
              className="w-3 h-3 mr-1 rounded-full object-contain"
            />
            <span className="font-medium text-[10px]">HyperSwap</span>
          </Button>
        )}
        {maestroTradeUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 bg-[#79F2E4] text-black hover:bg-[#62D5C7] transition-colors rounded flex items-center justify-center px-2"
            onClick={(e) => {
              e.stopPropagation()
              window.open(maestroTradeUrl, "_blank")
            }}
            title={`Trade ${token.symbol} with Maestro`}
          >
            <img
              src={MAESTRO_BUTTON_LOGO_URL || "/placeholder.svg"}
              alt="Maestro"
              className="w-3 h-3 mr-1 rounded-full object-contain"
            />
            <span className="font-medium text-[10px]">Maestro</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export default MobileTokenCard
