/**
 * Testy audit režimu Heureka importu (importOneFeed).
 *
 * Overuje:
 *  - audit feed s viac než sampleLimit položkami → audit_success (nie truncated/size_limit)
 *  - audit_success sa počíta medzi úspešné feedy, failedFeeds sa nezvýši
 *  - audit režim nezapisuje do hk_feeds (error_count, last_error, product_count)
 *  - audit režim nevkladá ani neaktualizuje hk_products
 *  - malformed XML v audit režime stále skončí parse_error
 *  - timeout v audit režime stále skončí timeout
 *  - full režim: size limit stále skončí truncated + size_limit (a zapíše hk_feeds)
 *
 * Spustenie: npx tsx scripts/test-heureka-audit-import.ts
 */
import assert from "node:assert/strict";
import {
  importOneFeed,
  isRunFeedSuccessStatus,
  getImportModeConfig,
  type HkFeedImportRow,
  type HeurekaImportModeConfig,
} from "../lib/heureka/import.ts";
import type { HkFeedDef } from "../lib/heureka/types.ts";

// ── mock sql: zaznamená každý dotaz, vráti prázdny result set ──
interface RecordedQuery {
  text: string;
  values: unknown[];
}

function createMockSql(log: RecordedQuery[]) {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    log.push({ text: strings.join("$?"), values });
    return Promise.resolve([]);
  };
  return sql as unknown as Parameters<typeof importOneFeed>[0];
}

function queriesTouching(log: RecordedQuery[], table: string): RecordedQuery[] {
  return log.filter((q) => q.text.includes(table));
}

// ── mock fetch ──
function buildFeedXml(itemCount: number): string {
  const items = Array.from(
    { length: itemCount },
    (_, i) =>
      `<SHOPITEM><PRODUCTNAME>Produkt ${i}</PRODUCTNAME><URL>https://shop.example/p/${i}</URL><PRICE_VAT>19.90</PRICE_VAT></SHOPITEM>`
  ).join("");
  return `<?xml version="1.0" encoding="utf-8"?><SHOP>${items}</SHOP>`;
}

function stubFetch(handler: () => Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const FEED: HkFeedImportRow = {
  id: "test-sk",
  url: "https://feed.example/products.xml",
  domain: "test.sk",
  category: "test",
  affiliate_url: null,
  enabled: true,
};

const NO_STATIC = new Map<string, HkFeedDef>();
const AUDIT_CONFIG = getImportModeConfig("audit");

async function run() {
  // 1. Audit feed s viac než sampleLimit položkami → audit_success, žiadny zápis do hk_feeds/hk_products
  {
    const log: RecordedQuery[] = [];
    const restore = stubFetch(async () => new Response(buildFeedXml(AUDIT_CONFIG.maxItems + 50)));
    const result = await importOneFeed(createMockSql(log), "run-1", FEED, "audit", AUDIT_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "audit_success");
    assert.equal(result.sampled, true);
    assert.equal(result.sampleLimit, AUDIT_CONFIG.maxItems);
    assert.equal(result.sampleProductCount, AUDIT_CONFIG.maxItems);
    assert.equal(result.productCount, AUDIT_CONFIG.maxItems);
    assert.equal(result.totalProductCount, null);
    assert.equal(result.feedHasMoreItems, true);
    assert.equal(result.errorType, null);
    assert.equal(result.errorMessage, undefined);

    // audit_success sa počíta ako úspech, nie failed
    assert.equal(isRunFeedSuccessStatus(result.status), true);

    // hk_feeds nedotknuté (error_count, last_error, product_count) a hk_products bez insert/update
    assert.equal(queriesTouching(log, "hk_feeds").length, 0);
    assert.equal(queriesTouching(log, "hk_products").length, 0);

    // do run tabuľky sa perzistuje DB-safe status 'success' (CHECK constraint), nie 'audit_success'
    const runFeedWrites = queriesTouching(log, "hk_import_run_feeds");
    assert.ok(runFeedWrites.length >= 2); // running + finálny status
    const finalWrite = runFeedWrites[runFeedWrites.length - 1];
    assert.ok(finalWrite.values.includes("success"));
    assert.ok(!finalWrite.values.includes("audit_success"));
    assert.ok(!finalWrite.values.includes("truncated"));
  }

  // 2. Audit feed menší než sampleLimit → audit_success s known totalProductCount
  {
    const log: RecordedQuery[] = [];
    const restore = stubFetch(async () => new Response(buildFeedXml(30)));
    const result = await importOneFeed(createMockSql(log), "run-2", FEED, "audit", AUDIT_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "audit_success");
    assert.equal(result.sampleProductCount, 30);
    assert.equal(result.totalProductCount, 30);
    assert.equal(result.feedHasMoreItems, false);
    assert.equal(queriesTouching(log, "hk_feeds").length, 0);
    assert.equal(queriesTouching(log, "hk_products").length, 0);
  }

  // 3. Malformed XML v audit režime → error + parse_error, hk_feeds stále nedotknuté
  {
    const log: RecordedQuery[] = [];
    const restore = stubFetch(async () => new Response("not xml at all <"));
    const result = await importOneFeed(createMockSql(log), "run-3", FEED, "audit", AUDIT_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "error");
    assert.equal(result.errorType, "parse_error");
    assert.equal(isRunFeedSuccessStatus(result.status), false);
    assert.equal(queriesTouching(log, "hk_feeds").length, 0);
    assert.equal(queriesTouching(log, "hk_products").length, 0);
    const finalWrite = queriesTouching(log, "hk_import_run_feeds").at(-1);
    assert.ok(finalWrite?.values.includes("error"));
  }

  // 4. Timeout v audit režime → error + timeout
  {
    const log: RecordedQuery[] = [];
    const restore = stubFetch(async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    const result = await importOneFeed(createMockSql(log), "run-4", FEED, "audit", AUDIT_CONFIG, NO_STATIC);
    restore();

    assert.equal(result.status, "error");
    assert.equal(result.errorType, "timeout");
    assert.equal(result.sampled, true);
    assert.equal(result.totalProductCount, null);
    assert.equal(queriesTouching(log, "hk_feeds").length, 0);
  }

  // 5. Full režim: size limit stále skončí truncated + size_limit a zapíše hk_feeds
  //    (full režim má maxItems=Infinity; limit simulujeme cez modeConfig, vetva je rovnaká)
  {
    const log: RecordedQuery[] = [];
    const fullConfig: HeurekaImportModeConfig = {
      maxItems: 100,
      feedTimeoutMs: 60_000,
      requestBudgetMs: 240_000,
    };
    const restore = stubFetch(async () => new Response(buildFeedXml(150)));
    const result = await importOneFeed(createMockSql(log), "run-5", FEED, "full", fullConfig, NO_STATIC);
    restore();

    assert.equal(result.status, "truncated");
    assert.equal(result.errorType, "size_limit");
    assert.equal(result.productCount, 0);
    assert.equal(isRunFeedSuccessStatus(result.status), false); // failedFeeds +1 vo full režime
    // full režim hk_feeds aktualizuje (error_count + last_error)
    const feedWrites = queriesTouching(log, "hk_feeds");
    assert.ok(feedWrites.length > 0);
    assert.ok(feedWrites[0].text.includes("error_count"));
    // truncated feed sa vo full režime neupsertuje do hk_products
    assert.equal(queriesTouching(log, "hk_products").length, 0);
  }

  // 6. Full režim: zdravý feed pod limitom → success + upsert do hk_products (regresná poistka)
  {
    const log: RecordedQuery[] = [];
    const fullConfig: HeurekaImportModeConfig = {
      maxItems: Number.POSITIVE_INFINITY,
      feedTimeoutMs: 60_000,
      requestBudgetMs: 240_000,
    };
    const restore = stubFetch(async () => new Response(buildFeedXml(10)));
    const result = await importOneFeed(createMockSql(log), "run-6", FEED, "full", fullConfig, NO_STATIC);
    restore();

    assert.equal(result.status, "success");
    assert.equal(result.productCount, 10);
    assert.ok(queriesTouching(log, "hk_products").length > 0);
  }

  console.log("Heureka audit import tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
