"use client"

import { Button } from "@/components/ui/button"

export default function TradeButtonsExample() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Trade Button Options</h2>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Current vs New Design</h3>

        {/* Current single button */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Current:</h4>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Trade
          </Button>
        </div>

        {/* New dual buttons */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">New Design:</h4>
          <div className="flex gap-2">
            {/* Neon Green Button */}
            <Button
              size="sm"
              className="bg-green-400 hover:bg-green-500 text-black font-semibold shadow-lg shadow-green-400/25 border-0"
              onClick={() => window.open("https://uniswap.org", "_blank")}
            >
              <div className="w-4 h-4 bg-pink-500 rounded-full mr-1"></div>
              {/* Placeholder logo - will be actual Uniswap logo */}
            </Button>

            {/* Purple Button */}
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg shadow-purple-600/25 border-0"
              onClick={() => window.open("https://pancakeswap.finance", "_blank")}
            >
              <div className="w-4 h-4 bg-yellow-400 rounded-full mr-1"></div>
              {/* Placeholder logo - will be actual PancakeSwap logo */}
            </Button>
          </div>
        </div>

        {/* Example in table context */}
        <div className="mt-8">
          <h4 className="text-sm font-medium text-gray-600 mb-2">In Table Context:</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Token</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">TVL</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">USDC</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">$1.2M</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="bg-green-400 hover:bg-green-500 text-black font-semibold shadow-sm h-7 px-2"
                      >
                        <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                      </Button>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm h-7 px-2"
                      >
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
