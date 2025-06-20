-- Check if RLS is enabled on memes_metrics
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'memes_metrics';

-- Check existing policies on memes_metrics
SELECT * FROM pg_policies WHERE tablename = 'memes_metrics';

-- Check what data the service role can actually see
SET ROLE service_role;
SELECT COUNT(*) as total_records,
       MIN(recorded_at) as earliest_record,
       MAX(recorded_at) as latest_record
FROM memes_metrics;
RESET ROLE;
