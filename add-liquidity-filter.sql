-- Add low_liquidity flag to tokens table
ALTER TABLE tokens 
ADD COLUMN low_liquidity BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tokens_low_liquidity ON tokens(low_liquidity);

-- Add liquidity threshold tracking
CREATE TABLE IF NOT EXISTS liquidity_thresholds (
  id SERIAL PRIMARY KEY,
  threshold_usd NUMERIC DEFAULT 10000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default threshold
INSERT INTO liquidity_thresholds (threshold_usd) VALUES (10000)
ON CONFLICT DO NOTHING;
