"use client"

import type React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink } from "lucide-react"
import type { Token } from "@/hooks/use-token-data"

// Props expected by this component
interface TokenTableRowProps {
  token: Token
  formatPrice: (price: number | null) => string
  formatTVL: (tvl: number | null | undefined) => string
  formatPercentageChange: (value: number | null) => string // Specifically for percentage changes
  formatAge: (createdAt: string | null) => string
  copyToClipboard: (text: string, event: React.MouseEvent, message?: string) => Promise<void>
  getCellAnimationClasses: (tokenId: string, field: string) => string
  getRowAnimationClasses: (tokenId: string) => string
}

// Ensure this is a default export
export default function TokenTableRow({
  token,
  formatPrice,
  formatTVL,
  formatPercentageChange, // Use the correct prop name
  formatAge,
  copyToClipboard,
  getCellAnimationClasses,
  getRowAnimationClasses,
}: TokenTableRowProps) {
  return (
    <TableRow key={token.id} className={`hover:bg-[#2d5a4f]/50 border-[#2d5a4f] ${getRowAnimationClasses(token.id)}`}>
      <TableCell className={`font-medium w-[160px] ${getCellAnimationClasses(token.id, "symbol")}`}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#2d5a4f] border border-[#51d2c1]/30 overflow-hidden flex-shrink-0">
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
            <div className="text-xs text-[#868d8f] flex items-center gap-2">
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
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-md w-full flex items-center justify-between gap-1"
            onClick={() =>
              window.open(`https://app.hyperswap.exchange/#/swap?outputCurrency=${token.contract_address}`, "_blank")
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
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] bg-[#51d2c1] text-black hover:bg-[#3baa9c] border-[#51d2c1] hover:border-[#3baa9c] transition-colors rounded-md w-full flex items-center justify-between gap-1"
            onClick={() => window.open(`https://t.me/maestro?start=${token.contract_address}-anonymiceagen`, "_blank")}
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
          {formatPercentageChange(token.price_change_30m)}
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
          {formatPercentageChange(token.price_change_24h)}
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
  )
}
