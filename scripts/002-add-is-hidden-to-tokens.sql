ALTER TABLE tokens
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tokens.is_hidden IS 'Flag to indicate if the token should be hidden from public frontend views and aggregate calculations (e.g., total market cap). Defaults to FALSE (visible).';

-- Optionally, update existing tokens if needed, though default FALSE is usually fine.
-- UPDATE tokens SET is_hidden = FALSE WHERE is_hidden IS NULL;
