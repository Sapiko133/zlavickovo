-- Mena produktu/feedu v pôvodnej mene feedu. NULL = mena nie je spoľahlivo známa.
-- Idempotentné — bezpečné spustiť opakovane (rovnaké DDL beží aj v /api/admin/heureka-migrate).

ALTER TABLE hk_feeds
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);

ALTER TABLE hk_products
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);

-- CHECK je bezpečný: stĺpce sú nové (existujúce riadky majú NULL) a jediná zapisovacia
-- cesta (lib/heureka/import.ts + resolveProductCurrency) ukladá výhradne 'EUR'/'CZK'/NULL.
-- Ak by v dátach predsa bola iná hodnota, ALTER zlyhá nahlas — nič sa nemaže ani neprepisuje.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hk_feeds_currency_code_check') THEN
    ALTER TABLE hk_feeds
      ADD CONSTRAINT hk_feeds_currency_code_check
      CHECK (currency_code IS NULL OR currency_code IN ('EUR', 'CZK'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hk_products_currency_code_check') THEN
    ALTER TABLE hk_products
      ADD CONSTRAINT hk_products_currency_code_check
      CHECK (currency_code IS NULL OR currency_code IN ('EUR', 'CZK'));
  END IF;
END $$;
