export default function MobileTokenCardSkeleton() {
  return (
    <div className="block md:hidden space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`mobile-skeleton-${index}`} className="bg-[#0f1a1f] border border-[#2d5a4f] rounded-lg p-3">
          {/* Row 1: Token Info + Price + Performance */}
          <div className="flex items-center justify-between mb-2">
            {/* Left: Token Info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Token Icon */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>
              {/* Token Symbol */}
              <div className="h-4 w-12 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
            </div>

            {/* Right: Price + Performance */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Price */}
              <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              {/* 24H Change */}
              <div className="h-4 w-12 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
            </div>
          </div>

          {/* Row 2: Contract Address + Social Links */}
          <div className="flex flex-col space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              <div className="text-xs text-[#868d8f] flex items-center gap-2">
                <span className="opacity-60">—</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#868d8f]">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
