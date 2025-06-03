-- Add updated_at column to memes_metrics table
ALTER TABLE memes_metrics 
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to have current timestamp
UPDATE memes_metrics 
SET updated_at = recorded_at 
WHERE updated_at IS NULL;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_memes_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_memes_metrics_updated_at ON memes_metrics;
CREATE TRIGGER update_memes_metrics_updated_at
    BEFORE UPDATE ON memes_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_memes_metrics_updated_at();
