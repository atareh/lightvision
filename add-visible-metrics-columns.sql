-- Add columns for visible tokens metrics
ALTER TABLE memes_metrics 
ADD COLUMN IF NOT EXISTS visible_market_cap numeric,
ADD COLUMN IF NOT EXISTS visible_volume_24h numeric,
ADD COLUMN IF NOT EXISTS visible_liquidity numeric,
ADD COLUMN IF NOT EXISTS visible_token_count integer,
ADD COLUMN IF NOT EXISTS visible_avg_price_change_1h numeric,
ADD COLUMN IF NOT EXISTS visible_avg_price_change_24h numeric;

-- Add comment to explain the difference
COMMENT ON TABLE memes_metrics IS 'Stores aggregate metrics for all enabled tokens and separately for only visible tokens (those that pass filtering criteria and appear in the UI)';
