-- Create a function to get tokens with their latest metrics efficiently
CREATE OR REPLACE FUNCTION get_tokens_with_latest_metrics()
RETURNS TABLE (
  id text,
  contract_address text,
  name text,
  symbol text,
  pair_address text,
  pair_created_at timestamp,
  dex_id text,
  chain_id text,
  image_url text,
  enabled boolean,
  created_at timestamp,
  updated_at timestamp,
  price_usd numeric,
  market_cap numeric,
  fdv numeric,
  volume_24h numeric,
  liquidity_usd numeric,
  holder_count integer,
  price_change_30m numeric,
  price_change_24h numeric,
  recorded_at timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.contract_address,
    t.name,
    t.symbol,
    t.pair_address,
    t.pair_created_at,
    t.dex_id,
    t.chain_id,
    t.image_url,
    t.enabled,
    t.created_at,
    t.updated_at,
    tm.price_usd,
    tm.market_cap,
    tm.fdv,
    tm.volume_24h,
    tm.liquidity_usd,
    tm.holder_count,
    tm.price_change_30m,
    tm.price_change_24h,
    tm.recorded_at
  FROM tokens t
  LEFT JOIN LATERAL (
    SELECT *
    FROM token_metrics tm2
    WHERE tm2.contract_address = t.contract_address
    ORDER BY tm2.recorded_at DESC
    LIMIT 1
  ) tm ON true
  WHERE t.enabled = true
  ORDER BY tm.market_cap DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;
