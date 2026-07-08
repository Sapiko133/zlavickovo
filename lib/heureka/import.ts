import { getDb } from "@/lib/db";
import { parseHeurekaXml } from "./parser";
import { HEUREKA_FEEDS } from "./feeds";
import { HEUREKA_MAX_ITEMS, HEUREKA_MAX_BYTES } from "./config";
import type { HkFeedDef, HkFeedErrorType, ImportFeedResult, PruneResult } from "./types";

const MAX_ITEMS = HEUREKA_MAX_ITEMS;   // zdieľaný limit (rovnaký ako v parseri)
const MAX_BYTES = HEUREKA_MAX_BYTES;   // núdzová brzda pre feedy s obrími položkami

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

// Klasifikácia chyby feedu pre observabilitu importu.
export function classifyFeedError(msg: string): HkFeedErrorType {
  if (/timeout|aborted|The operation was aborted/i.test(msg)) return "timeout";
  if (/^HTTP\s+\d/i.test(msg) || /HTTP\s+\d{3}/i.test(msg)) return "http_error";
  if (/parse|xml|unexpected|malformed|invalid/i.test(msg)) return "parse_error";
  return "unknown_error";
}

async function importSingleFeed(feed: HkFeedDef): Promise<ImportFeedResult> {
  const sql = getDb();
  const start = Date.now();

  try {
    const xml = await fetchXml(feed.url);
    const products = parseHeurekaXml(xml, feed.category).filter((p) => !isExcluded(p.name, feed.exclude));

    if (products.length === 0) {
      const durationMs = Date.now() - start;
      await sql`
        UPDATE hk_feeds
        SET last_fetched_at = now(), last_error = 'Žiadne produkty v XML', error_count = error_count + 1, last_duration_ms = ${durationMs}
        WHERE id = ${feed.id}
      `;
      return { feedId: feed.id, domain: feed.domain, count: 0, error: "Žiadne produkty", empty: true, durationMs };
    }

    // Deduplikácia podľa URL (kľúč ON CONFLICT) — jeden multi-row INSERT nesmie
    // obsahovať tú istú URL 2× (Postgres: "cannot affect row a second time").
    // Map zachová posledný výskyt = rovnaká sémantika ako pôvodný per-row upsert.
    const unique = Array.from(new Map(products.map((p) => [p.url, p])).values());

    // Bulk upsert cez UNNEST — 1 DB round-trip na dávku namiesto N single INSERT-ov.
    const BATCH = 200;
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      const feedIds      = chunk.map(() => feed.id);
      const names        = chunk.map((p) => p.name);
      const descriptions = chunk.map((p) => p.description);
      const prices       = chunk.map((p) => p.price);
      const urls         = chunk.map((p) => p.url);
      const imgs         = chunk.map((p) => p.imgUrl);
      const domains      = chunk.map(() => feed.domain);
      const cats         = chunk.map(() => feed.category);
      const affs         = chunk.map(() => feed.affiliateUrl);
      const eans         = chunk.map((p) => p.ean);
      const itemIds      = chunk.map((p) => p.itemId);
      const manus        = chunk.map((p) => p.manufacturer);
      const productnos   = chunk.map((p) => p.productno);

      await sql`
        INSERT INTO hk_products (feed_id, name, description, price, url, img_url, domain, category, affiliate_url, ean, item_id, manufacturer, productno)
        SELECT * FROM UNNEST(
          ${feedIds}::text[], ${names}::text[], ${descriptions}::text[], ${prices}::text[], ${urls}::text[],
          ${imgs}::text[], ${domains}::text[], ${cats}::text[], ${affs}::text[], ${eans}::text[],
          ${itemIds}::text[], ${manus}::text[], ${productnos}::text[]
        )
        ON CONFLICT (url) DO UPDATE SET
          name          = EXCLUDED.name,
          description   = EXCLUDED.description,
          price         = EXCLUDED.price,
          img_url       = EXCLUDED.img_url,
          affiliate_url = EXCLUDED.affiliate_url,
          ean           = EXCLUDED.ean,
          item_id       = EXCLUDED.item_id,
          manufacturer  = EXCLUDED.manufacturer,
          productno     = EXCLUDED.productno,
          updated_at    = now()
      `;
    }

    const durationMs = Date.now() - start;
    await sql`
      UPDATE hk_feeds
      SET last_fetched_at = now(), last_error = null, error_count = 0, product_count = ${unique.length}, last_duration_ms = ${durationMs}
      WHERE id = ${feed.id}
    `;

    return { feedId: feed.id, domain: feed.domain, count: unique.length, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = String(err?.message ?? err).slice(0, 500);
    const errorType = classifyFeedError(msg);
    try {
      await sql`
        UPDATE hk_feeds
        SET last_fetched_at = now(), last_error = ${msg}, error_count = error_count + 1, last_duration_ms = ${durationMs}
        WHERE id = ${feed.id}
      `;
    } catch {}
    return { feedId: feed.id, domain: feed.domain, count: 0, error: msg, errorType, durationMs };
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
              errorType: classifyFeedError(String((r as PromiseRejectedResult).reason)),
              durationMs: 0,
            }
      )
    );
  }

  return { results, prune };
}
