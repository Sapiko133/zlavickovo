import { getDb } from "@/lib/db";
import { parseHeurekaXml } from "./parser";
import { HEUREKA_FEEDS } from "./feeds";
import type { HkFeedDef, ImportFeedResult, PruneResult } from "./types";

const MAX_ITEMS = 500; // rovnaký limit ako v parseri
const MAX_BYTES = 20 * 1024 * 1024; // núdzová brzda pre feedy s obrími položkami

// Nájde koniec ďalšieho </SHOPITEM> (uppercase aj lowercase variant) od pozície `from`, -1 ak nie je
function nextShopitemEnd(xml: string, from: number): number {
  const upper = xml.indexOf("</SHOPITEM>", from);
  const lower = xml.indexOf("</shopitem>", from);
  const idx = upper === -1 ? lower : lower === -1 ? upper : Math.min(upper, lower);
  return idx === -1 ? -1 : idx + "</SHOPITEM>".length;
}

// Orezané XML treba korektne uzavrieť, inak ho parser zahodí
function closeTruncatedXml(xml: string): string {
  const closers: string[] = [];
  const head = xml.slice(0, 4096); // wrapper tagy (<rss>, <SHOP>) sú na začiatku feedu
  for (const m of head.matchAll(/<(rss|RSS|SHOP|shop)(?=[\s>])/g)) {
    closers.unshift(`</${m[1]}>`);
  }
  return xml + closers.join("");
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) return res.text();

  // Streamuj len začiatok feedu — parser berie max 500 produktov, celé XML (aj stovky MB) zabíjalo pamäť inštancie
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let xml = "";
  let items = 0;
  let searchFrom = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return xml + decoder.decode(); // feed má menej ako 500 položiek — je kompletný

      xml += decoder.decode(value, { stream: true });

      let end: number;
      while (items < MAX_ITEMS && (end = nextShopitemEnd(xml, searchFrom)) !== -1) {
        items++;
        searchFrom = end;
      }
      if (items >= MAX_ITEMS) {
        return closeTruncatedXml(xml.slice(0, searchFrom));
      }
      if (xml.length >= MAX_BYTES) {
        return searchFrom > 0 ? closeTruncatedXml(xml.slice(0, searchFrom)) : xml;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// Porovnávanie bez diakritiky — "CBD květy" musí chytiť výraz "cbd kvet"
const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function isExcluded(name: string, exclude?: string[]): boolean {
  if (!exclude?.length) return false;
  const n = deaccent(name);
  return exclude.some((term) => n.includes(term));
}

// Bezpečnostné čistenie DB pred importom:
// 1. zmaže produkty feedov, ktoré už nie sú v HEUREKA_FEEDS (vyradené feedy)
// 2. zmaže riadky vyradených feedov z hk_feeds
// 3. zmaže existujúce produkty, ktoré matchujú exclude filter svojho feedu
export async function pruneRemovedProducts(): Promise<PruneResult> {
  const sql = getDb();
  const ids = HEUREKA_FEEDS.map((f) => f.id);

  const orphanProducts = await sql`DELETE FROM hk_products WHERE feed_id <> ALL(${ids}) RETURNING id`;
  const orphanFeeds = await sql`DELETE FROM hk_feeds WHERE id <> ALL(${ids}) RETURNING id`;

  let excludedProducts = 0;
  for (const feed of HEUREKA_FEEDS) {
    if (!feed.exclude?.length) continue;
    // Diakritiku (květy vs kvety) nevie ILIKE bez unaccent extension — filtrujeme v JS
    const rows = (await sql`SELECT id, name FROM hk_products WHERE feed_id = ${feed.id}`) as { id: number; name: string }[];
    const toDelete = rows.filter((r) => isExcluded(r.name, feed.exclude)).map((r) => r.id);
    if (toDelete.length > 0) {
      await sql`DELETE FROM hk_products WHERE id = ANY(${toDelete})`;
      excludedProducts += toDelete.length;
    }
  }

  return {
    orphanProducts: orphanProducts.length,
    orphanFeeds: orphanFeeds.length,
    excludedProducts,
  };
}

async function importSingleFeed(feed: HkFeedDef): Promise<ImportFeedResult> {
  const sql = getDb();
  const start = Date.now();

  try {
    const xml = await fetchXml(feed.url);
    const products = parseHeurekaXml(xml, feed.category).filter((p) => !isExcluded(p.name, feed.exclude));

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

// Feedy sa importujú v batchoch po 10 — 54 paralelných fetchov sa delilo o bandwidth a validné XML padali na timeout
const FEED_BATCH = 10;

export async function importAllHeurekaFeeds(): Promise<{ results: ImportFeedResult[]; prune: PruneResult }> {
  const prune = await pruneRemovedProducts();
  const results: ImportFeedResult[] = [];

  for (let i = 0; i < HEUREKA_FEEDS.length; i += FEED_BATCH) {
    const batch = HEUREKA_FEEDS.slice(i, i + FEED_BATCH);
    const settled = await Promise.allSettled(batch.map(importSingleFeed));
    results.push(
      ...settled.map((r, j) =>
        r.status === "fulfilled"
          ? r.value
          : {
              feedId: batch[j].id,
              domain: batch[j].domain,
              count: 0,
              error: String((r as PromiseRejectedResult).reason),
              durationMs: 0,
            }
      )
    );
  }

  return { results, prune };
}
