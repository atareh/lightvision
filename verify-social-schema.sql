-- Verify the tokens table has the social columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tokens' 
AND column_name IN ('socials', 'websites');

-- Check if we have any existing social data
SELECT contract_address, symbol, socials, websites 
FROM tokens 
WHERE socials IS NOT NULL OR websites IS NOT NULL
LIMIT 5;

-- Test inserting sample social data to verify schema works
INSERT INTO tokens (
  id, 
  contract_address, 
  symbol, 
  socials, 
  websites, 
  enabled, 
  created_at, 
  updated_at
) VALUES (
  'test_social_token',
  '0xtest123',
  'TEST',
  '[{"platform": "twitter", "url": "https://x.com/test"}, {"platform": "telegram", "url": "https://t.me/test"}]'::jsonb,
  '[{"label": "Website", "url": "https://test.com"}]'::jsonb,
  false,
  NOW(),
  NOW()
) ON CONFLICT (contract_address) DO UPDATE SET
  socials = EXCLUDED.socials,
  websites = EXCLUDED.websites,
  updated_at = EXCLUDED.updated_at;

-- Clean up test data
DELETE FROM tokens WHERE contract_address = '0xtest123';
