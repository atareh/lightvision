"use client"

import { useState } from "react"
import { Menu, ExternalLink } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-sky-400/90 backdrop-blur-sm rounded-full px-4 sm:px-6 py-3 sm:py-4 shadow-lg relative z-10 border border-sky-300/30">
      <div className="flex items-center justify-between h-10 sm:h-auto">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <img src="/favicon.png" alt="LightVision Logo" className="w-5 h-5 sm:w-6 sm:h-6" />
          <h1 className="text-base sm:text-lg font-bold text-white">
            <span className="font-teodor font-normal">Light</span>
            <span className="font-teodor italic font-light">Vision</span>
          </h1>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-4 h-full">
          <a
            href="https://x.com/hypescreenerxyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-sans text-sm font-medium"
          >
            Twitter
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://app.hyperliquid.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-sans text-sm font-medium"
          >
            Hyperliquid
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://v3.hybridge.xyz/?referralFee=0.05&referralAddress=0x215EB5188AA8f227fAFF470881F6941bbAF5EfA1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-sans text-sm font-medium"
          >
            Bridge
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            className="bg-white/90 text-sky-700 hover:bg-white hover:text-sky-800 border-none rounded-full px-4 py-2 font-sans font-medium text-sm h-auto shadow-sm"
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
              <Button variant="ghost" size="sm" className="text-white hover:text-white/80 hover:bg-white/10 p-2 rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="bg-sky-400/95 backdrop-blur-sm border-sky-300/30">
              <div className="flex flex-col gap-4 mt-6 px-4 pb-6">
                <a
                  href="https://app.hyperliquid.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-sans text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hyperliquid
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href="https://v3.hybridge.xyz/?referralFee=0.05&referralAddress=0x215EB5188AA8f227fAFF470881F6941bbAF5EfA1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-sans text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Bridge
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Button
                  className="bg-white/90 text-sky-700 hover:bg-white hover:text-sky-800 border-none rounded-xl px-4 py-3 font-sans font-medium text-base w-full justify-center shadow-sm"
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
  )
}
