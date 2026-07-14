import { getDb } from "@/lib/db";
import { HEUREKA_FEEDS } from "@/lib/heureka/feeds";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();

    await sql`
      CREATE TABLE IF NOT EXISTS hk_feeds (
        id            TEXT PRIMARY KEY,
        url           TEXT NOT NULL,
        domain        TEXT DEFAULT '',
        category      TEXT DEFAULT '',
        affiliate_url TEXT DEFAULT '',
        currency_code VARCHAR(3),
        enabled       BOOLEAN DEFAULT true,
        last_fetched_at TIMESTAMPTZ,
        last_error    TEXT,
        error_count   INT DEFAULT 0,
        product_count INT DEFAULT 0,
        last_duration_ms INT DEFAULT 0
      )
    `;

    // Observabilita importu — trvanie posledného fetchu+upsertu daného feedu (idempotentne)
    await sql`ALTER TABLE hk_feeds ADD COLUMN IF NOT EXISTS last_duration_ms INT DEFAULT 0`;
    await sql`ALTER TABLE hk_feeds ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3)`;

    await sql`
      CREATE TABLE IF NOT EXISTS hk_products (
        id           BIGSERIAL PRIMARY KEY,
        feed_id      TEXT REFERENCES hk_feeds(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        description  TEXT DEFAULT '',
        price        TEXT DEFAULT '',
        currency_code VARCHAR(3),
        url          TEXT NOT NULL,
        img_url      TEXT DEFAULT '',
        domain       TEXT DEFAULT '',
        category     TEXT DEFAULT '',
        affiliate_url TEXT DEFAULT '',
        ean          TEXT DEFAULT '',
        item_id      TEXT DEFAULT '',
        manufacturer TEXT DEFAULT '',
        productno    TEXT DEFAULT '',
        search_vec   TSVECTOR GENERATED ALWAYS AS (
          to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
        ) STORED,
        updated_at   TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT hk_products_url_unique UNIQUE (url)
      )
    `;

    // Identifikátory produktov — pridaj do existujúcich tabuliek (fresh install ich má už z CREATE TABLE)
    await sql`ALTER TABLE hk_products ADD COLUMN IF NOT EXISTS ean          TEXT DEFAULT ''`;
    await sql`ALTER TABLE hk_products ADD COLUMN IF NOT EXISTS item_id      TEXT DEFAULT ''`;
    await sql`ALTER TABLE hk_products ADD COLUMN IF NOT EXISTS manufacturer TEXT DEFAULT ''`;
    await sql`ALTER TABLE hk_products ADD COLUMN IF NOT EXISTS productno    TEXT DEFAULT ''`;
    await sql`ALTER TABLE hk_products ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3)`;

    // CHECK je bezpečný: stĺpce currency_code sú nové (staré riadky = NULL) a import
    // ukladá výhradne 'EUR'/'CZK'/NULL. Pri neočakávanej hodnote ALTER zlyhá nahlas.
    await sql`
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
      END $$
    `;

    await sql`CREATE INDEX IF NOT EXISTS hk_products_search_idx  ON hk_products USING GIN(search_vec)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_ean_idx     ON hk_products(ean)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_manuf_idx   ON hk_products(manufacturer)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_domain_idx  ON hk_products(domain)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_cat_idx     ON hk_products(category)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_updated_idx ON hk_products(updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_feed_idx ON hk_products(feed_id)`;

    // ── História cien (Fáza 1: LEN tabuľka + indexy; žiadny zápis/čítanie/výpočty) ──
    await sql`
      CREATE TABLE IF NOT EXISTS product_price_history (
        id           BIGSERIAL PRIMARY KEY,
        product_url  TEXT NOT NULL,
        product_id   BIGINT REFERENCES hk_products(id) ON DELETE SET NULL,
        domain       TEXT NOT NULL,
        feed_slug    TEXT,
        price        NUMERIC(12,2) NOT NULL,
        currency     TEXT NOT NULL DEFAULT 'EUR',
        source       TEXT NOT NULL DEFAULT 'heureka',
        recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS product_price_history_product_url_recorded_at_idx ON product_price_history(product_url, recorded_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS product_price_history_recorded_at_idx ON product_price_history(recorded_at)`;

    // ── História cien (Vlna 2: zápisová vrstva) — dedup 1 snapshot/produkt/deň + doménový index ──
    // recorded_day musí byť IMMUTABLE (timestamptz::date je len STABLE) → explicitné UTC.
    await sql`
      ALTER TABLE product_price_history
        ADD COLUMN IF NOT EXISTS recorded_day DATE
        GENERATED ALWAYS AS (((recorded_at AT TIME ZONE 'UTC'))::date) STORED
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS product_price_history_url_day_uidx ON product_price_history(product_url, recorded_day)`;
    await sql`CREATE INDEX IF NOT EXISTS product_price_history_domain_recorded_idx ON product_price_history(domain, recorded_at DESC)`;
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_price_history_currency_check') THEN
          ALTER TABLE product_price_history
            ADD CONSTRAINT product_price_history_currency_check
            CHECK (currency IN ('EUR', 'CZK'));
        END IF;
      END $$
    `;

    // ── Popisy obchodov (AI generované offline, čítané na /kupony/[slug]) ──
    await sql`
      CREATE TABLE IF NOT EXISTS shop_descriptions (
        slug              TEXT PRIMARY KEY,
        shop_name         TEXT NOT NULL,
        short_description TEXT NOT NULL DEFAULT '',
        long_description  TEXT NOT NULL DEFAULT '',
        category          TEXT DEFAULT '',
        source            TEXT NOT NULL DEFAULT 'ai',
        ai_generated      BOOLEAN NOT NULL DEFAULT true,
        model             TEXT DEFAULT '',
        generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS shop_descriptions_updated_idx ON shop_descriptions(updated_at DESC)`;

    // ── Sledovanie ceny (§16) — uloženie podmienok; vyhodnotenie lib/heureka/price-watch ──
    await sql`
      CREATE TABLE IF NOT EXISTS price_watches (
        id                  BIGSERIAL PRIMARY KEY,
        email               TEXT NOT NULL,
        product_url         TEXT NOT NULL,
        domain              TEXT NOT NULL DEFAULT '',
        target_price        NUMERIC(12,2),
        target_drop_pct     INT,
        base_price          NUMERIC(12,2),
        currency            TEXT NOT NULL DEFAULT 'EUR',
        active              BOOLEAN NOT NULL DEFAULT true,
        unsub_token         TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_notified_at    TIMESTAMPTZ,
        last_notified_price NUMERIC(12,2)
      )
    `;
    await sql`ALTER TABLE price_watches ADD COLUMN IF NOT EXISTS unsub_token TEXT`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS price_watches_unsub_token_uidx ON price_watches(unsub_token) WHERE unsub_token IS NOT NULL`;
    // Jeden watch na (email, produkt); opätovné vytvorenie aktualizuje podmienky.
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS price_watches_email_url_uidx ON price_watches(email, product_url)`;
    await sql`CREATE INDEX IF NOT EXISTS price_watches_active_idx ON price_watches(product_url) WHERE active`;
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_watches_currency_check') THEN
          ALTER TABLE price_watches
            ADD CONSTRAINT price_watches_currency_check CHECK (currency IN ('EUR', 'CZK'));
        END IF;
        -- aspoň jedna podmienka: cieľová cena alebo percentuálny pokles
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_watches_condition_check') THEN
          ALTER TABLE price_watches
            ADD CONSTRAINT price_watches_condition_check
            CHECK (target_price IS NOT NULL OR target_drop_pct IS NOT NULL);
        END IF;
      END $$
    `;

    // Seed feedov
    for (const f of HEUREKA_FEEDS) {
      await sql`
        INSERT INTO hk_feeds (id, url, domain, category, affiliate_url, currency_code)
        VALUES (${f.id}, ${f.url}, ${f.domain}, ${f.category}, ${f.affiliateUrl}, ${f.currencyCode})
        ON CONFLICT (id) DO UPDATE SET
          url           = EXCLUDED.url,
          domain        = EXCLUDED.domain,
          category      = EXCLUDED.category,
          affiliate_url = EXCLUDED.affiliate_url,
          currency_code = EXCLUDED.currency_code
      `;
    }

    return Response.json({
      ok: true,
      message: "Migrácia dokončená",
      tables: ["hk_feeds", "hk_products", "product_price_history", "shop_descriptions", "price_watches"],
      feeds: HEUREKA_FEEDS.map((f) => f.id),
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
