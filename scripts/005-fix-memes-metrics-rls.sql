-- Enable RLS on memes_metrics table
ALTER TABLE memes_metrics ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow service role full access" ON memes_metrics;
DROP POLICY IF EXISTS "Allow public read access" ON memes_metrics;

-- Create policy for service role (API routes) - FULL ACCESS
CREATE POLICY "Allow service role full access" ON memes_metrics
FOR ALL USING (auth.role() = 'service_role');

-- Create policy for public access (frontend) - READ ONLY
CREATE POLICY "Allow public read access" ON memes_metrics
FOR SELECT USING (true);

-- Verify the policies were created
SELECT * FROM pg_policies WHERE tablename = 'memes_metrics';
