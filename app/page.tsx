"use client"

import SiteHeader from "@/components/site-header"
import StickyPill from "@/components/sticky-pill"
import HeroMetrics from "@/components/hero-metrics"
import HyperEVMTokenList from "@/components/hyperevm-token-list"
import TopMetrics from "@/components/top-metrics"
import SiteFooter from "@/components/site-footer"

export default function Dashboard() {
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
            <SiteHeader />
            <StickyPill />

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

            <SiteFooter />
          </main>
        </div>
      </div>
    </div>
  )
}
