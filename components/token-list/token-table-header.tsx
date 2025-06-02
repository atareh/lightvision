"use client"

import type React from "react"
import { TableHead, TableRow } from "@/components/ui/table"

interface TokenTableHeaderProps {
  handleSort: (column: string) => void
  renderSortIcon: (column: string) => React.ReactNode
}

const TokenTableHeader: React.FC<TokenTableHeaderProps> = ({ handleSort, renderSortIcon }) => {
  return (
    <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
      <TableHead className="text-gray-300 w-[160px]">
        <div className="flex items-center">Token</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[100px]">Trade</TableHead>
      <TableHead className="text-gray-300 w-[100px]" onClick={() => handleSort("price_usd")}>
        <div className="flex items-center cursor-pointer">Price {renderSortIcon("price_usd")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[150px]" onClick={() => handleSort("market_cap")}>
        <div className="flex items-center cursor-pointer">Market Cap {renderSortIcon("market_cap")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("price_change_30m")}>
        <div className="flex items-center cursor-pointer">1H {renderSortIcon("price_change_30m")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("price_change_24h")}>
        <div className="flex items-center cursor-pointer">24H {renderSortIcon("price_change_24h")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[140px]" onClick={() => handleSort("volume_24h")}>
        <div className="flex items-center cursor-pointer">Vol. 24H {renderSortIcon("volume_24h")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[140px]" onClick={() => handleSort("liquidity_usd")}>
        <div className="flex items-center cursor-pointer">Liquidity {renderSortIcon("liquidity_usd")}</div>
      </TableHead>
      <TableHead className="text-gray-300 w-[80px]" onClick={() => handleSort("age_days")}>
        <div className="flex items-center cursor-pointer">Age {renderSortIcon("age_days")}</div>
      </TableHead>
    </TableRow>
  )
}

export default TokenTableHeader
