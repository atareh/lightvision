import type React from "react"
import { Table, TableBody, TableHeader } from "@/components/ui/table"
import TokenTableHeader from "./token-table-header"
import TokenTableRow from "./token-table-row" // CRITICAL: Ensure this is a default import
import type { Token } from "@/hooks/use-token-data"

interface TokenTableProps {
  tokens: Token[]
  handleSort: (column: string) => void
  renderSortIcon: (column: string) => React.ReactNode
  formatPrice: (price: number | null) => string
  formatTVL: (tvl: number | null | undefined) => string
  formatPercentageChange: (value: number | null) => string // Ensure this prop name matches what TokenTableRow expects
  formatAge: (createdAt: string | null) => string
  copyToClipboard: (text: string, event: React.MouseEvent, message?: string) => Promise<void>
  getCellAnimationClasses: (tokenId: string, field: string) => string
  getRowAnimationClasses: (tokenId: string) => string
}

const TokenTable: React.FC<TokenTableProps> = ({
  tokens,
  handleSort,
  renderSortIcon,
  formatPrice,
  formatTVL,
  formatPercentageChange, // Pass the correctly named prop
  formatAge,
  copyToClipboard,
  getCellAnimationClasses,
  getRowAnimationClasses,
}) => {
  return (
    <div className="rounded-2xl border border-[#003c26] overflow-hidden">
      <Table>
        <TableHeader>
          <TokenTableHeader handleSort={handleSort} renderSortIcon={renderSortIcon} />
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TokenTableRow
              key={token.id}
              token={token}
              formatPrice={formatPrice}
              formatTVL={formatTVL}
              formatPercentageChange={formatPercentageChange} // Pass the correctly named prop
              formatAge={formatAge}
              copyToClipboard={copyToClipboard}
              getCellAnimationClasses={getCellAnimationClasses}
              getRowAnimationClasses={getRowAnimationClasses}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default TokenTable
