-- Create liquidity_thresholds table
CREATE TABLE IF NOT EXISTS liquidity_thresholds (
  id SERIAL PRIMARY KEY,
  threshold_usd NUMERIC NOT NULL,
  volume_threshold_usd NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT -- Optional notes for this threshold setting
);

-- Insert a default threshold if the table is empty
-- This ensures getFilterThresholds() in lib/token-filter.ts has a value to read
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM liquidity_thresholds) THEN
    INSERT INTO liquidity_thresholds (threshold_usd, volume_threshold_usd, notes)
    VALUES (10000, 1000, 'Default initial thresholds');
  END IF;
END $$;
