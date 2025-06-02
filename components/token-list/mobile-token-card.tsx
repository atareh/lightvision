"use client"

import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink } from "lucide-react"
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
    <div className="bg-[#1C2730] border border-[#2A3F4D] rounded-xl shadow-lg p-4 mb-4 text-gray-200">
      {/* Top Section: Logo, Name, Price, % Changes */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <img
            src={tokenLogoSrc || "/placeholder.svg"}
            alt={`${token.name} logo`}
            className="w-10 h-10 rounded-full object-cover bg-[#2A3F4D]"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.onerror = null
              target.src = `/placeholder.svg?width=40&height=40&query=${token.symbol || "TKN"}`
            }}
          />
          <div>
            <a
              href={tokenExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-lg font-semibold text-white hover:text-[#79F2E4] transition-colors truncate max-w-[180px]"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{token.name}</span>
              <ExternalLink className="h-4 w-4 ml-1.5 flex-shrink-0" />
            </a>
            <p className="text-2xl font-bold text-white mt-1">{formatPrice(token.price_usd)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2 text-xs">
          {/* Time period headers with arrows */}

          {/* Percentage badges */}
          <div className="flex space-x-2 flex-nowrap">
            {token.price_change_30m !== null && token.price_change_30m !== undefined ? (
              <div
                className={cn(
                  "px-2 py-1 rounded-full text-[10px] font-mono font-medium border",
                  token.price_change_30m >= 0
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-red-500/20 border-red-500/40 text-red-400",
                )}
              >
                1H {formatPercentageChange(token.price_change_30m)}
              </div>
            ) : (
              <div className="px-2 py-1 rounded-full text-[10px] font-mono font-medium bg-gray-600/20 border-gray-600/40 text-gray-400 border">
                1H N/A
              </div>
            )}

            {token.price_change_24h !== null && token.price_change_24h !== undefined ? (
              <div
                className={cn(
                  "px-2 py-1 rounded-full text-[10px] font-mono font-medium border",
                  token.price_change_24h >= 0
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-red-500/20 border-red-500/40 text-red-400",
                )}
              >
                24H {formatPercentageChange(token.price_change_24h)}
              </div>
            ) : (
              <div className="px-2 py-1 rounded-full text-[10px] font-mono font-medium bg-gray-600/20 border-gray-600/40 text-gray-400 border">
                24H N/A
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Social Links - aligned right */}
      <div className="flex items-center justify-end space-x-2 mb-2">
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
            ? allLinks.slice(0, 4).map((link: any, index: number) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 bg-[#2A3F4D] hover:bg-[#3A4F5D] rounded-lg transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  title={`${link?.platform && typeof link.platform === "string" && link.platform.length > 0 ? link.platform.charAt(0).toUpperCase() + link.platform.slice(1) : "Link"}`}
                >
                  {link?.platform === "twitter" && (
                    <img src="/icons/twitter-x-24.png" alt="Twitter" className="w-3 h-3" />
                  )}
                  {link?.platform === "telegram" && (
                    <img src="/icons/telegram-24.png" alt="Telegram" className="w-3 h-3" />
                  )}
                  {link?.platform === "discord" && (
                    <img src="/icons/discord-24.png" alt="Discord" className="w-3 h-3" />
                  )}
                  {link?.platform === "website" && (
                    <img src="/icons/geography-24.png" alt="Website" className="w-3 h-3" />
                  )}
                </a>
              ))
            : null
        })()}
      </div>

      {/* Mid Section: Contract Address, VOL, MCAP */}
      <div className="flex items-center justify-between text-xs mb-4 text-gray-400">
        <div className="flex items-center">
          {token.contract_address && (
            <>
              <span className="font-mono truncate max-w-[100px] sm:max-w-[120px]">
                {token.contract_address.substring(0, 6)}...
                {token.contract_address.substring(token.contract_address.length - 4)}
              </span>
              <button
                onClick={handleCopyToClipboard.bind(null, token.contract_address)}
                className="ml-1.5 text-gray-400 hover:text-[#79F2E4] transition-colors p-0.5"
                title="Copy contract address"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-[#2A3F4D] text-gray-300 px-2.5 py-1 text-[11px] font-mono rounded">
            VOL {formatTVL(token.volume_24h)}
          </Badge>
          <Badge variant="secondary" className="bg-[#2A3F4D] text-gray-300 px-2.5 py-1 text-[11px] font-mono rounded">
            MCAP {formatTVL(marketCapDisplayValue)}
          </Badge>
        </div>
      </div>

      {/* Trade Links */}
      <div className="grid grid-cols-2 gap-2.5">
        {hyperSwapTradeUrl && (
          <Button
            variant="ghost"
            size="lg"
            className="w-full h-11 bg-[#79F2E4] text-black hover:bg-[#62D5C7] transition-colors rounded-lg flex items-center justify-between px-3 py-2"
            onClick={(e) => {
              e.stopPropagation()
              window.open(hyperSwapTradeUrl, "_blank")
            }}
            title={`Trade ${token.symbol} on HyperSwap`}
          >
            <div className="flex items-center">
              <img
                src={HYPERSWAP_BUTTON_LOGO_URL || "/placeholder.svg"}
                alt="HyperSwap"
                className="w-5 h-5 mr-2 rounded-full object-contain"
              />
              <span className="font-semibold text-sm">Hyperswap</span>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-700" />
          </Button>
        )}
        {maestroTradeUrl && (
          <Button
            variant="ghost"
            size="lg"
            className="w-full h-11 bg-[#79F2E4] text-black hover:bg-[#62D5C7] transition-colors rounded-lg flex items-center justify-between px-3 py-2"
            onClick={(e) => {
              e.stopPropagation()
              window.open(maestroTradeUrl, "_blank")
            }}
            title={`Trade ${token.symbol} with Maestro`}
          >
            <div className="flex items-center">
              <img
                src={MAESTRO_BUTTON_LOGO_URL || "/placeholder.svg"}
                alt="Maestro"
                className="w-5 h-5 mr-2 rounded-full object-contain"
              />
              <span className="font-semibold text-sm">Maestro</span>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-700" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default MobileTokenCard
