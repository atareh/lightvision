"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
  isRefreshing?: boolean
  isMobile?: boolean
}

export default function PaginationControls({
  currentPage,
  totalPages,
  goToPage,
  isRefreshing = false,
  isMobile = false,
}: PaginationControlsProps) {
  if (totalPages <= 1 && !isMobile) {
    // Show refresh status even if no pagination needed on desktop
    return (
      <div className="hidden md:flex items-center justify-between mt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0f1a1f] border border-[#51d2c1]/30 text-[#51d2c1] shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-1">
            {isRefreshing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <span>Updates every minute</span>
            )}
          </div>
        </div>
        <div></div> {/* Empty div to keep justify-between working */}
      </div>
    )
  }

  if (totalPages <= 1 && isMobile) return null // No pagination needed for mobile if only one page

  if (isMobile) {
    return (
      <div className="flex md:hidden items-center justify-between mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <div className="text-sm text-gray-400">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="hidden md:flex items-center justify-between mt-6">
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0f1a1f] border border-[#51d2c1]/30 text-[#51d2c1] shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-1">
            {isRefreshing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <span>Updates every minute</span>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Page {currentPage} of {totalPages}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum
            if (totalPages <= 5) {
              pageNum = i + 1
            } else if (currentPage <= 3) {
              pageNum = i + 1
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i
            } else {
              pageNum = currentPage - 2 + i
            }
            return (
              <Button
                key={pageNum}
                variant="outline"
                size="sm"
                onClick={() => goToPage(pageNum)}
                className={`w-8 h-8 p-0 rounded-md ${
                  currentPage === pageNum
                    ? "bg-[#51d2c1] text-black border-[#51d2c1]"
                    : "bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black"
                }`}
              >
                {pageNum}
              </Button>
            )
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
