-- Enable RLS on all tables
ALTER TABLE daily_stats_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dune_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dune_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperevm_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow service role full access" ON daily_stats_raw;
DROP POLICY IF EXISTS "Allow service role full access" ON dashboard_metrics;
DROP POLICY IF EXISTS "Allow service role full access" ON dune_executions;
DROP POLICY IF EXISTS "Allow service role full access" ON dune_results;
DROP POLICY IF EXISTS "Allow service role full access" ON hyperevm_protocols;
DROP POLICY IF EXISTS "Allow service role full access" ON token_metrics;
DROP POLICY IF EXISTS "Allow service role full access" ON tokens;

DROP POLICY IF EXISTS "Allow public read access" ON daily_stats_raw;
DROP POLICY IF EXISTS "Allow public read access" ON dashboard_metrics;
DROP POLICY IF EXISTS "Allow public read access" ON dune_executions;
DROP POLICY IF EXISTS "Allow public read access" ON dune_results;
DROP POLICY IF EXISTS "Allow public read access" ON hyperevm_protocols;
DROP POLICY IF EXISTS "Allow public read access" ON token_metrics;
DROP POLICY IF EXISTS "Allow public read access" ON tokens;
