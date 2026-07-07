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
        enabled       BOOLEAN DEFAULT true,
        last_fetched_at TIMESTAMPTZ,
        last_error    TEXT,
        error_count   INT DEFAULT 0,
        product_count INT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS hk_products (
        id           BIGSERIAL PRIMARY KEY,
        feed_id      TEXT REFERENCES hk_feeds(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        description  TEXT DEFAULT '',
        price        TEXT DEFAULT '',
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

    await sql`CREATE INDEX IF NOT EXISTS hk_products_search_idx  ON hk_products USING GIN(search_vec)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_ean_idx     ON hk_products(ean)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_manuf_idx   ON hk_products(manufacturer)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_domain_idx  ON hk_products(domain)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_cat_idx     ON hk_products(category)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_updated_idx ON hk_products(updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS hk_products_feed_idx ON hk_products(feed_id)`;

    // Seed feedov
    for (const f of HEUREKA_FEEDS) {
      await sql`
        INSERT INTO hk_feeds (id, url, domain, category, affiliate_url)
        VALUES (${f.id}, ${f.url}, ${f.domain}, ${f.category}, ${f.affiliateUrl})
        ON CONFLICT (id) DO UPDATE SET
          url           = EXCLUDED.url,
          domain        = EXCLUDED.domain,
          category      = EXCLUDED.category,
          affiliate_url = EXCLUDED.affiliate_url
      `;
    }

    return Response.json({
      ok: true,
      message: "Migrácia dokončená",
      tables: ["hk_feeds", "hk_products"],
      feeds: HEUREKA_FEEDS.map((f) => f.id),
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
