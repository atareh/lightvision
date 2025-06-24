-- Add indexes for better query performance on frequently accessed columns

-- Index for dune_results table - most queries order by block_day
CREATE INDEX IF NOT EXISTS idx_dune_results_block_day ON dune_results(block_day);
CREATE INDEX IF NOT EXISTS idx_dune_results_updated_at ON dune_results(updated_at);

-- Index for daily_revenue table - most queries order by day  
CREATE INDEX IF NOT EXISTS idx_daily_revenue_day ON daily_revenue(day);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_updated_at ON daily_revenue(updated_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_dune_results_day_netflow ON dune_results(block_day, netflow);
CREATE INDEX IF NOT EXISTS idx_dune_results_day_address_count ON dune_results(block_day, address_count);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_day_revenue ON daily_revenue(day, revenue);
