-- Drop existing tokens table if it exists (since we're restructuring)
DROP TABLE IF EXISTS tokens CASCADE;

-- Create tokens table (static metadata)
CREATE TABLE IF NOT EXISTS tokens (
id text PRIMARY KEY, -- e.g., geckoterminal's token id like "hyperevm_0xcontractaddress"
contract_address text UNIQUE NOT NULL, -- Actual contract address, lowercased
name text,
symbol text,
pair_address text, -- From the trending pool
pair_created_at timestamp, -- Pool creation time
dex_id text, -- From the trending pool
chain_id text DEFAULT 'hyperevm',
image_url text, -- Final image URL to use (could be manual or from Gecko)
gecko_image_url text, -- <<<< THIS COLUMN IS NEEDED
manual_image boolean DEFAULT false, -- <<<< THIS COLUMN IS NEEDED
websites jsonb, -- <<<< THIS COLUMN IS NEEDED
socials jsonb, -- <<<< THIS COLUMN IS NEEDED
enabled boolean DEFAULT true,
low_liquidity boolean DEFAULT false, -- <<<< THIS COLUMN IS NEEDED
low_volume boolean DEFAULT false, -- <<<< THIS COLUMN IS NEEDED
is_hidden boolean DEFAULT false, -- If true, token is hidden from public view
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
-- Note: contract_address should be lowercase for consistency with cron logic
INSERT INTO tokens (id, contract_address, name, symbol, enabled, websites, socials, image_url, gecko_image_url, manual_image, is_hidden) VALUES
('hyperevm_0x1230000000000000000000000000000000000abc', '0x1230000000000000000000000000000000000abc', 'Purr', 'PURR', true, '[{"label": "website", "url": "https://purr.example.com"}]', '[{"platform": "twitter", "url": "https://twitter.com/purrtoken"}]', 'https://example.com/purr.png', 'https://example.com/purr_gecko.png', false, false),
('hyperevm_0x4560000000000000000000000000000000000def', '0x4560000000000000000000000000000000000def', 'HyperCat', 'HCAT', true, null, null, null, null, false, false),
('hyperevm_0x7890000000000000000000000000000000000ghi', '0x7890000000000000000000000000000000000ghi', 'MoonDoge', 'MDOGE', true, null, null, null, null, false, false)
ON CONFLICT (contract_address) DO NOTHING;
