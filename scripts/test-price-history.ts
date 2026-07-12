/**
 * Testy cenovej histórie (Vlna 2) — zápis snapshotov + read štatistika.
 *
 * ZÁPIS (importOneFeed / recordPriceSnapshots):
 *  A. full režim, zdravý .sk feed → snapshot iba pre platné ceny; neplatná cena
 *     (0) sa preskočí, duplicitná URL vo feede sa zapíše raz
 *  B. mena sa nedá spoľahlivo určiť (doména mimo .sk/.cz, cena bez symbolu) →
 *     žiadny snapshot (žiadne fiktívne ceny)
 *  C. audit režim → žiadny zápis do product_price_history
 *  D. prázdny feed (0 produktov) → žiadny snapshot (guard productCount>0)
 *  E. denný dedup: druhý zápis v ten istý deň (ON CONFLICT DO NOTHING) zachová
 *     PRVÝ snapshot dňa — ranná cena sa neprepíše popoludňajšou
 *
 * READ (getProductPriceStats):
 *  F. <2 snapshoty → null
 *  G. viac mien v okne → null (cross-currency min/max by klamalo)
 *  H. bežný prípad → aktuálna/min/max + pokles od maxima zaokrúhlený na celé %
 *  I. nekladná cena → null
 *
 * DB aj fetch sú stubnuté — bez produkčnej DB a siete.
 * Spustenie: npx tsx scripts/test-price-history.ts
 */
import assert from "node:assert/strict";
import {
  importOneFeed,
  recordPriceSnapshots,
  getImportModeConfig,
  type HkFeedImportRow,
} from "../lib/heureka/import.ts";
import { getProductPriceStats } from "../lib/heureka/price-history.ts";
import type { HkFeedDef } from "../lib/heureka/types.ts";

interface RecordedQuery {
  text: string;
  values: unknown[];
}

interface SnapshotRow {
  url: string;
  price: string;
  currency: string;
  day: string;
}

// Fixný „deň" pre dedup (recorded_day je v produkcii DB-generated z recorded_at).
const TODAY = "2026-07-12";

interface SnapshotStore {
  rows: SnapshotRow[];
  keys: Set<string>; // url|day — modeluje UNIQUE(product_url, recorded_day)
}

function createSnapshotStore(): SnapshotStore {
  return { rows: [], keys: new Set() };
}

// Mock sql: zaznamená dotazy, INSERT do product_price_history aplikuje
// ON CONFLICT (product_url, recorded_day) DO NOTHING proti store.
function createMockSql(log: RecordedQuery[], store: SnapshotStore) {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("$?");
    log.push({ text, values });

    if (text.includes("INSERT INTO product_price_history")) {
      const urls = values[0] as string[];
      const prices = values[3] as string[];
      const currencies = values[4] as string[];
      urls.forEach((url, i) => {
        const key = `${url}|${TODAY}`;
        if (store.keys.has(key)) return; // DO NOTHING — zachovaj prvý dňa
        store.keys.add(key);
        store.rows.push({ url, price: prices[i], currency: currencies[i], day: TODAY });
      });
    }
    return Promise.resolve([]);
  };
  return sql as unknown as Parameters<typeof importOneFeed>[0];
}

function snapshotInserts(log: RecordedQuery[]): RecordedQuery[] {
  return log.filter((q) => q.text.includes("INSERT INTO product_price_history"));
}

// ── mock fetch: feed s explicitne zadanými (url, price) položkami ──
function feedXml(items: Array<{ url: string; price: string }>): string {
  const body = items
    .map(
      (it) =>
        `<SHOPITEM><PRODUCTNAME>P</PRODUCTNAME><URL>${it.url}</URL><PRICE_VAT>${it.price}</PRICE_VAT></SHOPITEM>`
    )
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?><SHOP>${body}</SHOP>`;
}

function stubFetch(xml: string): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(xml)) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const NO_STATIC = new Map<string, HkFeedDef>();
const FULL_CONFIG = getImportModeConfig("full");
const AUDIT_CONFIG = getImportModeConfig("audit");

function feed(overrides: Partial<HkFeedImportRow> = {}): HkFeedImportRow {
  return {
    id: "test-sk",
    url: "https://feed.example/products.xml",
    domain: "test.sk", // .sk → EUR
    category: "test",
    affiliate_url: null,
    currency_code: null,
    enabled: true,
    ...overrides,
  };
}

// Minimalistický produkt pre recordPriceSnapshots (parser tvar: url + price + currencyCode)
function product(url: string, price: string, currencyCode: string | null = null) {
  return { url, price, currencyCode } as unknown as Parameters<typeof recordPriceSnapshots>[2][number];
}

async function run() {
  // A. full .sk feed: platná cena zapísaná, 0 preskočená, duplicitná URL raz
  {
    const log: RecordedQuery[] = [];
    const store = createSnapshotStore();
    const restore = stubFetch(
      feedXml([
        { url: "https://test.sk/p/0", price: "19.90" },
        { url: "https://test.sk/p/1", price: "0" }, // neplatná → skip
        { url: "https://test.sk/p/0", price: "25.00" }, // duplicitná URL → prvá ostáva
      ])
    );
    const result = await importOneFeed(createMockSql(log, store), "run-A", feed(), "full", FULL_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "success");
    assert.equal(store.rows.length, 1, "iba jeden platný unikátny snapshot");
    assert.equal(store.rows[0].url, "https://test.sk/p/0");
    assert.equal(store.rows[0].price, "19.90"); // prvá cena URL, nie 25.00
    assert.equal(store.rows[0].currency, "EUR"); // .sk → EUR
  }

  // B. mena neznáma (doména mimo .sk/.cz, cena bez symbolu) → žiadny snapshot
  {
    const log: RecordedQuery[] = [];
    const store = createSnapshotStore();
    const restore = stubFetch(feedXml([{ url: "https://shop.example/p/0", price: "19.90" }]));
    const result = await importOneFeed(
      createMockSql(log, store),
      "run-B",
      feed({ id: "x", domain: "shop.example", url: "https://feed.example/x.xml" }),
      "full",
      FULL_CONFIG,
      NO_STATIC
    );
    restore();

    assert.equal(result.status, "success");
    assert.equal(store.rows.length, 0);
    assert.equal(snapshotInserts(log).length, 0);
  }

  // C. audit režim → žiadny zápis histórie
  {
    const log: RecordedQuery[] = [];
    const store = createSnapshotStore();
    const restore = stubFetch(feedXml([{ url: "https://test.sk/p/0", price: "19.90" }]));
    const result = await importOneFeed(createMockSql(log, store), "run-C", feed(), "audit", AUDIT_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "audit_success");
    assert.equal(snapshotInserts(log).length, 0, "audit nesmie zapisovať do product_price_history");
  }

  // D. prázdny feed → žiadny snapshot (guard productCount>0)
  {
    const log: RecordedQuery[] = [];
    const store = createSnapshotStore();
    // SHOPITEM bez URL sa odfiltruje → products.length 0 → status "empty"
    const restore = stubFetch(`<?xml version="1.0"?><SHOP><SHOPITEM><PRODUCTNAME>P</PRODUCTNAME></SHOPITEM></SHOP>`);
    const result = await importOneFeed(createMockSql(log, store), "run-D", feed(), "full", FULL_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "empty");
    assert.equal(snapshotInserts(log).length, 0);
  }

  // E. denný dedup: druhý zápis v ten istý deň zachová prvú (rannú) cenu
  {
    const log: RecordedQuery[] = [];
    const store = createSnapshotStore();
    const sql = createMockSql(log, store);

    await recordPriceSnapshots(sql, feed(), [product("https://test.sk/p/0", "19.90")]);
    await recordPriceSnapshots(sql, feed(), [product("https://test.sk/p/0", "9.90")]); // popoludní lacnejšie

    assert.equal(store.rows.length, 1, "ON CONFLICT DO NOTHING — jeden riadok na deň");
    assert.equal(store.rows[0].price, "19.90", "zachovaná PRVÁ cena dňa");
  }

  // ── READ: getProductPriceStats ──
  const statsSql = (row: Record<string, unknown>) =>
    ((async () => [row]) as unknown as Parameters<typeof getProductPriceStats>[2]);

  // F. <2 snapshoty → null
  {
    const stats = await getProductPriceStats(
      "https://test.sk/p/0",
      90,
      statsSql({ n: 1, currencies: 1, min_price: 10, max_price: 10, current_price: 10, currency: "EUR" })
    );
    assert.equal(stats, null);
  }

  // G. viac mien v okne → null
  {
    const stats = await getProductPriceStats(
      "https://test.sk/p/0",
      90,
      statsSql({ n: 5, currencies: 2, min_price: 10, max_price: 20, current_price: 12, currency: "EUR" })
    );
    assert.equal(stats, null);
  }

  // H. bežný prípad → aktuálna/min/max + pokles od maxima (celé %)
  {
    const stats = await getProductPriceStats(
      "https://test.sk/p/0",
      90,
      statsSql({ n: 8, currencies: 1, min_price: 70, max_price: 100, current_price: 70, currency: "EUR" })
    );
    assert.ok(stats);
    assert.equal(stats!.current, 70);
    assert.equal(stats!.min, 70);
    assert.equal(stats!.max, 100);
    assert.equal(stats!.dropFromMaxPct, 30);
    assert.equal(stats!.currency, "EUR");
  }

  // I. nekladná cena → null
  {
    const stats = await getProductPriceStats(
      "https://test.sk/p/0",
      90,
      statsSql({ n: 3, currencies: 1, min_price: 0, max_price: 0, current_price: 0, currency: "EUR" })
    );
    assert.equal(stats, null);
  }

  console.log("Price history tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
