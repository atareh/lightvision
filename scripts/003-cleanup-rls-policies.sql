-- Clean up redundant policies for dune_executions
DROP POLICY IF EXISTS "Allow service role full access" ON public.dune_executions;

-- Clean up redundant policies for dune_results
DROP POLICY IF EXISTS "Allow service role full access" ON public.dune_results;

-- Clean up redundant policies for cron_logs
DROP POLICY IF EXISTS "Allow service role full access" ON public.cron_logs;

-- Clean up redundant policies for cmc_data
DROP POLICY IF EXISTS "Allow service role full access" ON public.cmc_data;

-- Clean up redundant policies for daily_revenue
-- Option 1: Keep "Public read access for daily_revenue" and "Service role full access for daily_revenue"
DROP POLICY IF EXISTS "Allow public read access" ON public.daily_revenue;
DROP POLICY IF EXISTS "Allow service role full access" ON public.daily_revenue;
-- Option 2 (if you prefer the other names, adjust accordingly):
-- DROP POLICY IF EXISTS "Public read access for daily_revenue" ON public.daily_revenue;
-- DROP POLICY IF EXISTS "Service role full access for daily_revenue" ON public.daily_revenue;

-- Verify remaining policies (optional, run this in your SQL client)
-- SELECT * FROM pg_policies WHERE tablename IN ('dune_executions', 'dune_results', 'cron_logs', 'cmc_data', 'daily_revenue');
