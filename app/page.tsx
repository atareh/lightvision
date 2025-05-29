"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import HeroMetrics from "@/components/hero-metrics"
import HyperEVMTokenList from "@/components/hyperevm-token-list"
import TopMetrics from "@/components/top-metrics"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { useCryptoData } from "@/hooks/use-crypto-data"
import { formatCurrency, abbreviateNumber } from "@/lib/utils"

export default function Dashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: cryptoData, loading: cryptoLoading, error: cryptoError } = useCryptoData()

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
      }}
    >
      <div className="p-4 md:p-6">
        <div className="container mx-auto max-w-7xl">
          {/* Main content */}
          <main>
            {/* Header */}
            <header className="bg-[#0f1a1f] rounded-full px-4 sm:px-6 py-3 sm:py-4 shadow-lg relative z-10">
              <div className="flex items-center justify-between h-10 sm:h-auto">
                {/* Logo and Brand */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <img src="/favicon.png" alt="HyperScreener Logo" className="w-5 h-5 sm:w-6 sm:h-6" />
                  <h1 className="text-base sm:text-lg font-bold text-white">
                    <span className="font-teodor font-normal">Hype</span>
                    <span className="font-teodor italic font-light">Screener</span>
                  </h1>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden sm:flex items-center gap-4 h-full">
                  <a
                    href="https://app.hyperliquid.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-white hover:text-[#51d2c1] transition-colors font-sans text-sm"
                  >
                    Hyperliquid
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://v3.hybridge.xyz/?referralFee=0.05&referralAddress=0x215EB5188AA8f227fAFF470881F6941bbAF5EfA1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-white hover:text-[#51d2c1] transition-colors font-sans text-sm"
                  >
                    Bridge
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    className="bg-[#51d2c1] text-black hover:bg-[#3fb8a8] hover:text-black border-none rounded-full px-4 py-2 font-sans font-medium text-sm h-auto"
                    onClick={() => window.open("https://app.hyperliquid.xyz/join/ATAREH", "_blank")}
                  >
                    Join Hyperliquid
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>

                {/* Mobile Hamburger Menu */}
                <div className="sm:hidden">
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:text-[#51d2c1] hover:bg-transparent p-2"
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="top" className="bg-[#0f1a1f] border-[#51d2c1]/20">
                      <div className="flex flex-col gap-4 mt-6 px-4 pb-6">
                        <a
                          href="https://app.hyperliquid.xyz"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white hover:text-[#51d2c1] transition-colors font-sans text-base"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Hyperliquid
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <a
                          href="https://v3.hybridge.xyz/?referralFee=0.05&referralAddress=0x215EB5188AA8f227fAFF470881F6941bbAF5EfA1"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white hover:text-[#51d2c1] transition-colors font-sans text-base"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Bridge
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          className="bg-[#51d2c1] text-black hover:bg-[#3fb8a8] hover:text-black border-none rounded-xl px-4 py-3 font-sans font-medium text-base w-full justify-center"
                          onClick={() => {
                            window.open("https://app.hyperliquid.xyz/join/ATAREH", "_blank")
                            setMobileMenuOpen(false)
                          }}
                        >
                          Join Hyperliquid
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </header>

            {/* Sticky pill - placed immediately after header */}
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
                    <span
                      className={`${cryptoData.hype.percent_change_24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                    >
                      ({cryptoData.hype.percent_change_24h >= 0 ? "+" : ""}
                      {cryptoData.hype.percent_change_24h.toFixed(1)}% 24H)
                    </span>
                  )}
                </div>

                {/* HYPE Price in center */}
                <div className="flex items-center gap-1">
                  <span className="text-[#51d2c1] font-medium">$HYPE:</span>
                  <span className="text-white font-bold">
                    {cryptoData ? formatCurrency(cryptoData.hype.price) : "—"}
                  </span>
                  {cryptoData && (
                    <span
                      className={`${cryptoData.hype.percent_change_24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}`}
                    >
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
                  <span className="text-white font-medium">
                    {cryptoData ? formatCurrency(cryptoData.hype.price) : "—"}
                  </span>
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

            {/* Top metrics (below the pill) */}
            <section className="mt-2 mb-6 sm:mb-8 md:mb-10">
              <TopMetrics />
            </section>

            {/* Hero Metrics */}
            <section className="mb-6 sm:mb-8 md:mb-10">
              <HeroMetrics />
            </section>

            {/* Token List */}
            <section className="relative z-0">
              <h2 className="text-xl font-semibold mb-6">HyperEVM</h2>
              <HyperEVMTokenList />
            </section>

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t border-white/10">
              <div className="flex flex-col items-center gap-3">
                <img src="/favicon.png" alt="HyperScreener Logo" className="w-8 h-8 opacity-60" />
                <p className="text-sm text-white/60 font-mono">
                  Made by{" "}
                  <a
                    href="https://x.com/atareh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff4f00] hover:text-[#ff4f00]/80 transition-colors"
                  >
                    @atareh
                  </a>
                </p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}
