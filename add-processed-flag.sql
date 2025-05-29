-- Add processed column to track our processing status separately from Dune status
ALTER TABLE dune_executions 
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Mark all existing completed executions as processed (except the 6pm ones we want to test)
UPDATE dune_executions 
SET processed = true 
WHERE status IN ('COMPLETED', 'FAILED') 
AND created_at < '2025-01-26 17:00:00';

-- The 6pm executions should remain processed = false for our test
