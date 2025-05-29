-- Drop existing tokens table if it exists (since we're restructuring)
DROP TABLE IF EXISTS tokens CASCADE;

-- Create tokens table (static metadata)
CREATE TABLE IF NOT EXISTS tokens (
  id text PRIMARY KEY,
  contract_address text UNIQUE NOT NULL,
  name text,
  symbol text,
  pair_address text,
  pair_created_at timestamp,
  dex_id text,
  chain_id text DEFAULT 'hyperevm',
  image_url text,
  enabled boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Create token_metrics table (time series data)
CREATE TABLE IF NOT EXISTS token_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL REFERENCES tokens(contract_address) ON DELETE CASCADE,
  price_usd numeric,
  market_cap numeric,
  fdv numeric,
  volume_24h numeric,
  liquidity_usd numeric,
  holder_count integer,
  price_change_30m numeric,
  price_change_24h numeric,
  recorded_at timestamp DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_enabled ON tokens(enabled);
CREATE INDEX IF NOT EXISTS idx_tokens_contract_address ON tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_token_metrics_contract_address ON token_metrics(contract_address);
CREATE INDEX IF NOT EXISTS idx_token_metrics_recorded_at ON token_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_token_metrics_contract_recorded ON token_metrics(contract_address, recorded_at DESC);

-- Insert some initial tokens to track (you can modify these)
INSERT INTO tokens (id, contract_address, name, symbol, enabled) VALUES
('0x123...abc', '0x123...abc', 'Purr', 'PURR', true),
('0x456...def', '0x456...def', 'HyperCat', 'HCAT', true),
('0x789...ghi', '0x789...ghi', 'MoonDoge', 'MDOGE', true)
ON CONFLICT (contract_address) DO NOTHING;
