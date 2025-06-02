export interface DuneExecutionResultRow {
  block_day: string // Or Date
  address_count?: number | string | null
  deposit?: number | string | null
  withdraw?: number | string | null
  netflow?: number | string | null
  TVL?: number | string | null // Matches 'TVL' from your existing code
  // Add any other fields returned by your Dune query 5184581
}

// You might already have other types here
