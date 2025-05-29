-- Create policies for service role (your API routes) - FULL ACCESS
CREATE POLICY "Allow service role full access" ON daily_stats_raw
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON dashboard_metrics
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON dune_executions
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON dune_results
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON hyperevm_protocols
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON token_metrics
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON tokens
FOR ALL USING (auth.role() = 'service_role');

-- Create policies for public access (frontend) - READ ONLY
CREATE POLICY "Allow public read access" ON daily_stats_raw
FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON dashboard_metrics
FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON hyperevm_protocols
FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON token_metrics
FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON tokens
FOR SELECT USING (true);

-- Note: dune_executions and dune_results are internal only - no public read access
