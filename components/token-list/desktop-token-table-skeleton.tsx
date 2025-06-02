import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function DesktopTokenTableSkeleton() {
  return (
    <div className="hidden md:block rounded-2xl border border-[#003c26] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f] bg-[#01493a]">
            <TableHead className="text-gray-300 w-[160px]">
              <div className="flex items-center">Token</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[100px]">Trade</TableHead>
            <TableHead className="text-gray-300 w-[100px]">
              <div className="flex items-center">Price</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[150px]">
              <div className="flex items-center">Market Cap</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[80px]">
              <div className="flex items-center">1h</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[80px]">
              <div className="flex items-center">24h</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[140px]">
              <div className="flex items-center">Volume 24h</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[140px]">
              <div className="flex items-center">Liquidity</div>
            </TableHead>
            <TableHead className="text-gray-300 w-[80px]">
              <div className="flex items-center">Age</div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`} className="hover:bg-[#2d5a4f]/50 border-[#2d5a4f]">
              <TableCell className="font-medium w-[160px]">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>
                  <div>
                    <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded mb-1"></div>
                    <div className="h-3 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="w-[100px]">
                <div className="h-7 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
              </TableCell>
              <TableCell className="w-[100px]">
                <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              </TableCell>
              <TableCell className="w-[150px]">
                <div className="h-4 w-24 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              </TableCell>
              <TableCell className="w-[80px]">
                <div className="h-6 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
              </TableCell>
              <TableCell className="w-[80px]">
                <div className="h-6 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded-full"></div>
              </TableCell>
              <TableCell className="w-[140px]">
                <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              </TableCell>
              <TableCell className="w-[140px]">
                <div className="h-4 w-20 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              </TableCell>
              <TableCell className="w-[80px]">
                <div className="h-4 w-16 bg-gradient-to-r from-[#2d5a4f] via-[#51d2c1]/30 to-[#2d5a4f] bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
