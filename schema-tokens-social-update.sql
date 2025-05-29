-- Add social links columns to the tokens table
ALTER TABLE tokens 
ADD COLUMN IF NOT EXISTS websites JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '[]';

-- Create indexes for better performance on social data queries
CREATE INDEX IF NOT EXISTS idx_tokens_socials ON tokens USING GIN (socials);
CREATE INDEX IF NOT EXISTS idx_tokens_websites ON tokens USING GIN (websites);

-- Example of how the data will be stored:
-- websites: [{"label": "Website", "url": "https://example.com"}, {"label": "Docs", "url": "https://docs.example.com"}]
-- socials: [{"type": "twitter", "url": "https://x.com/example"}, {"type": "telegram", "url": "https://t.me/example"}]
