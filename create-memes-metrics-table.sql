-- Create table for tracking aggregate memes metrics over time
CREATE TABLE IF NOT EXISTS memes_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamp DEFAULT NOW(),
  total_market_cap numeric,
  total_volume_24h numeric,
  total_liquidity numeric,
  token_count integer,
  avg_price_change_1h numeric,
  avg_price_change_24h numeric,
  created_at timestamp DEFAULT NOW()
);

-- Create index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_memes_metrics_recorded_at ON memes_metrics(recorded_at DESC);
