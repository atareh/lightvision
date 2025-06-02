"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface MobilePaginationProps {
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
}

export default function MobilePagination({ currentPage, totalPages, goToPage }: MobilePaginationProps) {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-6 mb-2 w-full max-w-xs mx-auto">
      {/* Previous Button - Fixed Left */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-9 px-3 bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>

      {/* Page Numbers - Center (only show 3: prev, current, next) */}
      <div className="flex items-center space-x-1">
        {currentPage > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            className="h-8 w-8 p-0 bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black"
          >
            {currentPage - 1}
          </Button>
        )}

        <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-[#51d2c1] text-black border-[#51d2c1]">
          {currentPage}
        </Button>

        {currentPage < totalPages && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            className="h-8 w-8 p-0 bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black"
          >
            {currentPage + 1}
          </Button>
        )}
      </div>

      {/* Next Button - Fixed Right */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-9 px-3 bg-[#2d5a4f] border-[#2d5a4f] text-white hover:bg-[#51d2c1] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}
