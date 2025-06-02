"use client"

import { useCryptoData } from "@/hooks/use-crypto-data"
import { formatCurrency, abbreviateNumber } from "@/lib/utils"

export default function StickyPill() {
  const { data: cryptoData } = useCryptoData()

  return (
    <div
      className="sticky top-0 z-40 bg-[#0f1a1f] rounded-b-[28px] px-1 sm:px-4 py-1 sm:py-2 shadow-lg mx-auto w-fit transition-all duration-300 ease-in-out"
      style={{ marginTop: "-1px" }}
    >
      {/* Desktop Layout */}
      <div
        className="hidden sm:flex items-center justify-between gap-2 sm:gap-3 md:gap-4 font-mono uppercase min-w-[250px] sm:min-w-[400px] md:min-w-[550px]"
        style={{ fontSize: "11px" }}
      >
        {/* Market Cap on left */}
        <div className="flex items-center gap-1">
          <span className="text-[#868d8f]">MARKET CAP:</span>
          <span className="text-white font-medium">
            {cryptoData ? `$${abbreviateNumber(cryptoData.hype.market_cap)}` : "—"}
          </span>
          {cryptoData && (
            <span className={`${cryptoData.hype.percent_change_24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}>
              ({cryptoData.hype.percent_change_24h >= 0 ? "+" : ""}
              {cryptoData.hype.percent_change_24h.toFixed(1)}% 24H)
            </span>
          )}
        </div>

        {/* HYPE Price in center */}
        <div className="flex items-center gap-1">
          <span className="text-[#51d2c1] font-medium">$HYPE:</span>
          <span className="text-white font-bold">{cryptoData ? formatCurrency(cryptoData.hype.price) : "—"}</span>
          {cryptoData && (
            <span className={`${cryptoData.hype.percent_change_24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}>
              ({cryptoData.hype.percent_change_24h >= 0 ? "+" : ""}
              {cryptoData.hype.percent_change_24h.toFixed(1)}% 24H)
            </span>
          )}
        </div>

        {/* 24H Volume on right */}
        <div className="flex items-center gap-1">
          <span className="text-[#868d8f]">24H VOL:</span>
          <span className="text-white font-medium">
            {cryptoData ? `$${abbreviateNumber(cryptoData.hype.volume_24h)}` : "—"}
          </span>
          {cryptoData && (
            <span className={`${cryptoData.hype.volume_change_24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}>
              ({cryptoData.hype.volume_change_24h >= 0 ? "+" : ""}
              {cryptoData.hype.volume_change_24h.toFixed(1)}% 24H)
            </span>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div
        className="flex sm:hidden items-center justify-center gap-2 font-mono uppercase px-2"
        style={{ fontSize: "10px" }}
      >
        {/* Market Cap */}
        <div className="flex items-center gap-1">
          <span className="text-[#868d8f]">MCAP:</span>
          <span className="text-white font-medium">
            {cryptoData ? `$${abbreviateNumber(cryptoData.hype.market_cap)}` : "—"}
          </span>
        </div>

        {/* HYPE Price */}
        <div className="flex items-center gap-1">
          <span className="text-[#51d2c1] font-medium">$HYPE:</span>
          <span className="text-white font-medium">{cryptoData ? formatCurrency(cryptoData.hype.price) : "—"}</span>
        </div>

        {/* 24H Volume */}
        <div className="flex items-center gap-1">
          <span className="text-[#868d8f]">VOL:</span>
          <span className="text-white font-medium">
            {cryptoData ? `$${abbreviateNumber(cryptoData.hype.volume_24h)}` : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}
