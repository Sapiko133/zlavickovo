import { getDb } from "@/lib/db";
import { parseHeurekaXml } from "./parser";
import { HEUREKA_FEEDS } from "./feeds";
import type { HkFeedDef, ImportFeedResult } from "./types";

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function importSingleFeed(feed: HkFeedDef): Promise<ImportFeedResult> {
  const sql = getDb();
  const start = Date.now();

  try {
    const xml = await fetchXml(feed.url);
    const products = parseHeurekaXml(xml, feed.category);

    if (products.length === 0) {
      await sql`
        UPDATE hk_feeds
        SET last_fetched_at = now(), last_error = 'Žiadne produkty v XML', error_count = error_count + 1
        WHERE id = ${feed.id}
      `;
      return { feedId: feed.id, domain: feed.domain, count: 0, error: "Žiadne produkty", durationMs: Date.now() - start };
    }

    // Upsert v batchoch po 50
    const BATCH = 50;
    for (let i = 0; i < products.length; i += BATCH) {
      const chunk = products.slice(i, i + BATCH);
      await Promise.all(
        chunk.map((p) =>
          sql`
            INSERT INTO hk_products (feed_id, name, description, price, url, img_url, domain, category, affiliate_url)
            VALUES (${feed.id}, ${p.name}, ${p.description}, ${p.price}, ${p.url}, ${p.imgUrl}, ${feed.domain}, ${feed.category}, ${feed.affiliateUrl})
            ON CONFLICT (url) DO UPDATE SET
              name          = EXCLUDED.name,
              description   = EXCLUDED.description,
              price         = EXCLUDED.price,
              img_url       = EXCLUDED.img_url,
              affiliate_url = EXCLUDED.affiliate_url,
              updated_at    = now()
          `
        )
      );
    }

    await sql`
      UPDATE hk_feeds
      SET last_fetched_at = now(), last_error = null, error_count = 0, product_count = ${products.length}
      WHERE id = ${feed.id}
    `;

    return { feedId: feed.id, domain: feed.domain, count: products.length, durationMs: Date.now() - start };
  } catch (err: any) {
    const msg = String(err?.message ?? err).slice(0, 500);
    try {
      await sql`
        UPDATE hk_feeds
        SET last_fetched_at = now(), last_error = ${msg}, error_count = error_count + 1
        WHERE id = ${feed.id}
      `;
    } catch {}
    return { feedId: feed.id, domain: feed.domain, count: 0, error: msg, durationMs: Date.now() - start };
  }
}

// 3 feedy paralelne — pri škálovaní na 203 zmeniť na batche po 10
export async function importAllHeurekaFeeds(): Promise<ImportFeedResult[]> {
  const settled = await Promise.allSettled(HEUREKA_FEEDS.map(importSingleFeed));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          feedId: HEUREKA_FEEDS[i].id,
          domain: HEUREKA_FEEDS[i].domain,
          count: 0,
          error: String((r as PromiseRejectedResult).reason),
          durationMs: 0,
        }
  );
}
