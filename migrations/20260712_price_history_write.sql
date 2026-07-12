-- História cien – Vlna 2: zápisová vrstva.
-- Tabuľka product_price_history + jej dva indexy existujú z Fázy 1
-- (app/api/admin/heureka-migrate). Tento krok dopĺňa iba to, čo treba na
-- bezpečný denný zápis a čítanie štatistík. Idempotentné – rovnaké DDL beží
-- aj v /api/admin/heureka-migrate.

-- Deň záznamu v UTC pre dedup „1 snapshot / produkt / deň".
-- Generated STORED výraz musí byť IMMUTABLE: timestamptz::date je len STABLE
-- (závisí od TimeZone), preto explicitné AT TIME ZONE 'UTC'.
ALTER TABLE product_price_history
  ADD COLUMN IF NOT EXISTS recorded_day DATE
  GENERATED ALWAYS AS (((recorded_at AT TIME ZONE 'UTC'))::date) STORED;

-- Denný dedup. Zápis používa ON CONFLICT DO NOTHING → zachová sa PRVÝ snapshot
-- dňa (ranná cena), popoludňajší re-run ho neprepíše.
CREATE UNIQUE INDEX IF NOT EXISTS product_price_history_url_day_uidx
  ON product_price_history(product_url, recorded_day);

-- Shop read (getBiggestPriceDropsByDomain) filtruje najprv podľa domény nad
-- celým katalógom – doménovo vedený index.
CREATE INDEX IF NOT EXISTS product_price_history_domain_recorded_idx
  ON product_price_history(domain, recorded_at DESC);

-- Mena len EUR/CZK (rovnako ako hk_products.currency_code). Zápisová cesta
-- neznámu menu preskočí, takže CHECK nič neblokuje; pri neočakávanej hodnote
-- zlyhá nahlas. Tabuľka je zatiaľ prázdna (žiadny zápis pred Vlnou 2).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_price_history_currency_check') THEN
    ALTER TABLE product_price_history
      ADD CONSTRAINT product_price_history_currency_check
      CHECK (currency IN ('EUR', 'CZK'));
  END IF;
END $$;
