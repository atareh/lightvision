"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ExternalLink } from "lucide-react"

// Placeholder data for tokens
const hyperEVMTokens = [
  {
    name: "WIF",
    symbol: "WIF",
    price: 0.12,
    change24h: 3.4,
    marketCap: "14M",
    volume24h: "2.1M",
    buyLiquidity: "1.3M",
    sellLiquidity: "800K",
    referralLink: "/trade/wif",
  },
  {
    name: "Bonk",
    symbol: "BONK",
    price: 0.000023,
    change24h: 5.2,
    marketCap: "142M",
    volume24h: "8.3M",
    buyLiquidity: "4.2M",
    sellLiquidity: "3.1M",
    referralLink: "/trade/bonk",
  },
  {
    name: "Jupiter",
    symbol: "JUP",
    price: 0.85,
    change24h: -2.1,
    marketCap: "950M",
    volume24h: "12.5M",
    buyLiquidity: "6.8M",
    sellLiquidity: "5.7M",
    referralLink: "/trade/jup",
  },
  {
    name: "Jito",
    symbol: "JTO",
    price: 2.34,
    change24h: 1.8,
    marketCap: "270M",
    volume24h: "5.4M",
    buyLiquidity: "3.2M",
    sellLiquidity: "2.2M",
    referralLink: "/trade/jto",
  },
  {
    name: "Pyth Network",
    symbol: "PYTH",
    price: 0.42,
    change24h: -0.7,
    marketCap: "520M",
    volume24h: "3.8M",
    buyLiquidity: "2.1M",
    sellLiquidity: "1.7M",
    referralLink: "/trade/pyth",
  },
]

const ecosystemTokens = [
  {
    name: "HyperLiquid",
    symbol: "HYPE",
    price: 3.42,
    change24h: 5.2,
    marketCap: "342M",
    volume24h: "18.5M",
    buyLiquidity: "9.3M",
    sellLiquidity: "7.2M",
    referralLink: "/trade/hype",
  },
  {
    name: "Royco",
    symbol: "ROYCO",
    price: 1.24,
    change24h: 8.7,
    marketCap: "124M",
    volume24h: "6.2M",
    buyLiquidity: "3.5M",
    sellLiquidity: "2.7M",
    referralLink: "/trade/royco",
  },
  {
    name: "HyperVault",
    symbol: "HVLT",
    price: 0.78,
    change24h: -1.3,
    marketCap: "78M",
    volume24h: "4.1M",
    buyLiquidity: "2.3M",
    sellLiquidity: "1.8M",
    referralLink: "/trade/hvlt",
  },
  {
    name: "HyperBridge",
    symbol: "HBRG",
    price: 2.15,
    change24h: 3.9,
    marketCap: "215M",
    volume24h: "7.8M",
    buyLiquidity: "4.1M",
    sellLiquidity: "3.7M",
    referralLink: "/trade/hbrg",
  },
  {
    name: "HyperDAO",
    symbol: "HDAO",
    price: 0.56,
    change24h: 2.4,
    marketCap: "56M",
    volume24h: "2.9M",
    buyLiquidity: "1.6M",
    sellLiquidity: "1.3M",
    referralLink: "/trade/hdao",
  },
]

export default function TokenList() {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === "asc" ? (
      <ArrowUpDown className="ml-2 h-4 w-4 text-blue-400" />
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4 text-blue-400 transform rotate-180" />
    )
  }

  return (
    <Card className="bg-[#0f1a1f] border-[#51d2c1] rounded-2xl shadow">
      <CardContent className="p-6">
        <Tabs defaultValue="hyperEVM">
          <TabsList className="mb-6 bg-[#2d5a4f] rounded-full">
            <TabsTrigger
              value="hyperEVM"
              className="data-[state=active]:bg-[#51d2c1] data-[state=active]:text-black rounded-full px-4 py-2 text-sm font-medium"
            >
              HyperEVM
            </TabsTrigger>
            <TabsTrigger
              value="ecosystem"
              className="data-[state=active]:bg-[#51d2c1] data-[state=active]:text-black rounded-full px-4 py-2 text-sm font-medium"
            >
              Ecosystem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hyperEVM" className="mt-0">
            <div className="rounded-2xl border border-[#003c26] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
                    <TableHead className="text-gray-300" onClick={() => handleSort("name")}>
                      <div className="flex items-center cursor-pointer">Token {renderSortIcon("name")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("price")}>
                      <div className="flex items-center cursor-pointer">Price {renderSortIcon("price")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("change24h")}>
                      <div className="flex items-center cursor-pointer">24h Change {renderSortIcon("change24h")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("marketCap")}>
                      <div className="flex items-center cursor-pointer">Market Cap {renderSortIcon("marketCap")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("volume24h")}>
                      <div className="flex items-center cursor-pointer">24h Volume {renderSortIcon("volume24h")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300">Liquidity</TableHead>
                    <TableHead className="text-gray-300 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hyperEVMTokens.map((token) => (
                    <TableRow key={token.symbol} className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f]">
                      <TableCell className="font-medium text-white">{token.symbol}</TableCell>
                      <TableCell>${token.price.toLocaleString()}</TableCell>
                      <TableCell className={token.change24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}>
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h}%
                      </TableCell>
                      <TableCell>${token.marketCap}</TableCell>
                      <TableCell>${token.volume24h}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-[#20a67d]">Buy: ${token.buyLiquidity}</div>
                          <div className="text-[#ed7188]">Sell: ${token.sellLiquidity}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] border-[#51d2c1] hover:border-white transition-colors rounded-full"
                        >
                          Trade <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ecosystem" className="mt-0">
            <div className="rounded-2xl border border-[#003c26] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
                    <TableHead className="text-gray-300" onClick={() => handleSort("name")}>
                      <div className="flex items-center cursor-pointer">Token {renderSortIcon("name")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("price")}>
                      <div className="flex items-center cursor-pointer">Price {renderSortIcon("price")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("change24h")}>
                      <div className="flex items-center cursor-pointer">24h Change {renderSortIcon("change24h")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("marketCap")}>
                      <div className="flex items-center cursor-pointer">Market Cap {renderSortIcon("marketCap")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300" onClick={() => handleSort("volume24h")}>
                      <div className="flex items-center cursor-pointer">24h Volume {renderSortIcon("volume24h")}</div>
                    </TableHead>
                    <TableHead className="text-gray-300">Liquidity</TableHead>
                    <TableHead className="text-gray-300 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecosystemTokens.map((token) => (
                    <TableRow key={token.symbol} className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f]">
                      <TableCell className="font-medium text-white">{token.symbol}</TableCell>
                      <TableCell>${token.price.toLocaleString()}</TableCell>
                      <TableCell className={token.change24h >= 0 ? "text-[#20a67d]" : "text-[#ed7188]"}>
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h}%
                      </TableCell>
                      <TableCell>${token.marketCap}</TableCell>
                      <TableCell>${token.volume24h}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-[#20a67d]">Buy: ${token.buyLiquidity}</div>
                          <div className="text-[#ed7188]">Sell: ${token.sellLiquidity}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1] border-[#51d2c1] hover:border-white transition-colors rounded-full"
                        >
                          Trade <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
