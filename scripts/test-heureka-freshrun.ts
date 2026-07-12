/**
 * Testy freshRun parametra Heureka importu (importHeurekaBatch).
 *
 * Overuje:
 *  A. audit bez freshRun → pokračuje v existujúcom partial audit rune
 *     (rovnaký runId, zdedené počítadlá, pokračuje od checkpointu)
 *  B. audit s freshRun=1 → ignoruje existujúci partial run, vytvorí nový run,
 *     počítadlá od nuly, checkpoint nezačína hodnotou zo starého runu,
 *     starý partial run ostáva nedotknutý
 *  C. full s freshRun=1 → freshRun sa ignoruje, full resume správanie nezmenené
 *  D. fresh audit jedného zdravého feedu nad 100 položiek → run status success,
 *     successfulFeeds=1, failedFeeds=0, feed status audit_success,
 *     žiadny zápis do hk_products, žiadna aktualizácia hk_feeds
 *
 * DB je simulovaná in-memory fake sql klientom (options.sqlClient), feed fetch
 * je stubnutý — testy sa nedotýkajú produkčnej DB ani siete.
 *
 * Spustenie: npx tsx scripts/test-heureka-freshrun.ts
 */
import assert from "node:assert/strict";
import {
  importHeurekaBatch,
  type ImportHeurekaBatchOptions,
  type HkFeedImportRow,
} from "../lib/heureka/import.ts";
import { HEUREKA_AUDIT_MAX_ITEMS } from "../lib/heureka/config.ts";

type SqlClient = NonNullable<ImportHeurekaBatchOptions["sqlClient"]>;

interface RecordedQuery {
  text: string;
  values: unknown[];
}

interface FakeRun {
  id: string;
  mode: string;
  status: string;
  total_feeds: number;
  processed_feeds: number;
  successful_feeds: number;
  failed_feeds: number;
  cursor_feed_id: string | null;
  error_summary: string | null;
  started_at: number;
}

interface FakeDb {
  feeds: HkFeedImportRow[];
  runs: FakeRun[];
  queries: RecordedQuery[];
  seq: number;
}

function createFakeDb(feeds: HkFeedImportRow[], runs: FakeRun[]): FakeDb {
  return { feeds, runs, queries: [], seq: runs.length + 1 };
}

function projectRun(run: FakeRun) {
  return {
    id: run.id,
    mode: run.mode,
    status: run.status,
    total_feeds: run.total_feeds,
    processed_feeds: run.processed_feeds,
    successful_feeds: run.successful_feeds,
    failed_feeds: run.failed_feeds,
    cursor_feed_id: run.cursor_feed_id,
    error_summary: run.error_summary,
  };
}

function mustRun(db: FakeDb, runId: unknown): FakeRun {
  const run = db.runs.find((r) => r.id === runId);
  if (!run) throw new Error(`FakeDb: run ${String(runId)} neexistuje`);
  return run;
}

function dispatch(db: FakeDb, text: string, values: unknown[]): unknown[] {
  if (text.includes("hk_import_locks")) {
    if (text.includes("INSERT INTO hk_import_locks")) {
      return [{ expires_at: new Date(Date.now() + 600_000).toISOString() }];
    }
    return []; // attachRunToLock / releaseImportLock
  }

  // finalizeRunIfDone / hasRemainingFeeds — počet feedov za checkpointom runu
  if (text.includes("AS remaining")) {
    const run = db.runs.find((r) => r.id === values[0]);
    const cursor = run?.cursor_feed_id ?? "";
    return [{ remaining: db.feeds.filter((f) => f.id > cursor).length }];
  }

  if (text.includes("hk_import_run_feeds")) return [];
  if (text.includes("hk_products")) return [];

  if (text.includes("hk_import_runs")) {
    if (text.includes("INSERT INTO hk_import_runs")) {
      const [id, mode, totalFeeds] = values as [string, string, number];
      const run: FakeRun = {
        id,
        mode,
        status: "running",
        total_feeds: totalFeeds,
        processed_feeds: 0,
        successful_feeds: 0,
        failed_feeds: 0,
        cursor_feed_id: null,
        error_summary: null,
        started_at: db.seq++,
      };
      db.runs.push(run);
      return [projectRun(run)];
    }
    if (text.includes("status IN ('running', 'partial')")) {
      const active = [...db.runs]
        .filter((r) => r.status === "running" || r.status === "partial")
        .sort((a, b) => b.started_at - a.started_at)[0];
      return active ? [projectRun(active)] : [];
    }
    if (text.includes("processed_feeds = processed_feeds + 1")) {
      const [succ, fail, feedId, errorSummary, runId] = values as [
        number, number, string, string | null, string,
      ];
      const run = mustRun(db, runId);
      run.status = "partial";
      run.processed_feeds += 1;
      run.successful_feeds += succ;
      run.failed_feeds += fail;
      run.cursor_feed_id = feedId;
      run.error_summary = errorSummary ?? run.error_summary;
      return [];
    }
    if (text.includes("SET status = 'running'")) {
      mustRun(db, values[0]).status = "running";
      return [];
    }
    if (text.includes("SET status = 'partial'")) {
      mustRun(db, values[0]).status = "partial";
      return [];
    }
    if (text.includes("SET status = 'error'")) {
      mustRun(db, values[1]).status = "error";
      return [];
    }
    if (text.includes("SET status = 'success'")) {
      // finalizeRunIfDone: remaining=0 → vždy success + finished_at
      const run = mustRun(db, values[0]);
      run.status = "success";
      return [projectRun(run)];
    }
    if (text.includes("SELECT id, mode, status")) {
      const run = db.runs.find((r) => r.id === values[0]);
      return run ? [projectRun(run)] : [];
    }
    throw new Error(`FakeDb: neobslúžený hk_import_runs dotaz: ${text}`);
  }

  if (text.includes("hk_feeds")) {
    if (text.includes("INSERT INTO hk_feeds")) return []; // syncStaticHeurekaFeeds
    if (text.includes("COUNT(*)::int AS total")) return [{ total: db.feeds.length }];
    if (text.includes("UPDATE hk_feeds")) return []; // full režim zapisuje výsledok feedu
    // selectNextFeeds
    const sorted = [...db.feeds].sort((a, b) => (a.id < b.id ? -1 : 1));
    if (text.includes("id > $?")) {
      const [cursor, limit] = values as [string, number];
      return sorted.filter((f) => f.id > cursor).slice(0, limit);
    }
    const [limit] = values as [number];
    return sorted.slice(0, limit);
  }

  throw new Error(`FakeDb: neobslúžený dotaz: ${text}`);
}

function createFakeSql(db: FakeDb): SqlClient {
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("$?");
    db.queries.push({ text, values });
    return dispatch(db, text, values);
  };
  return sql as unknown as SqlClient;
}

// ── mock fetch: zdravý feed s viac než HEUREKA_AUDIT_MAX_ITEMS položkami ──
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

// Feed pred aj za starým checkpointom "aeromodel-sk" — dokazuje, či sa run
// rozbehol od začiatku (fresh), alebo pokračoval od checkpointu (resume).
const FEED_BEFORE_CHECKPOINT: HkFeedImportRow = {
  id: "aaa-obchod-sk",
  url: "https://feed.example/aaa.xml",
  domain: "aaa-obchod.sk",
  category: "test",
  affiliate_url: null,
  enabled: true,
};

const FEED_AFTER_CHECKPOINT: HkFeedImportRow = {
  id: "zzz-obchod-sk",
  url: "https://feed.example/zzz.xml",
  domain: "zzz-obchod.sk",
  category: "test",
  affiliate_url: null,
  enabled: true,
};

const OLD_RUN_ID = "74876f2c-old-partial";

function oldPartialRun(mode: "audit" | "full"): FakeRun {
  return {
    id: OLD_RUN_ID,
    mode,
    status: "partial",
    total_feeds: 2,
    processed_feeds: 1,
    successful_feeds: 0,
    failed_feeds: 1,
    cursor_feed_id: "aeromodel-sk",
    error_summary: "aeromodel-sk: HTTP 500",
    started_at: 1,
  };
}

async function run() {
  const restore = stubFetch(async () => new Response(buildFeedXml(HEUREKA_AUDIT_MAX_ITEMS + 50)));

  try {
    // A. audit bez freshRun → pokračuje v existujúcom partial audit rune
    {
      const db = createFakeDb(
        [FEED_BEFORE_CHECKPOINT, FEED_AFTER_CHECKPOINT],
        [oldPartialRun("audit")]
      );
      const result = await importHeurekaBatch({ mode: "audit", sqlClient: createFakeSql(db) });

      assert.equal(result.ok, true);
      assert.equal(result.runId, OLD_RUN_ID);
      assert.equal(db.runs.length, 1); // žiadny nový run
      // pokračuje od checkpointu: aaa-obchod-sk (< aeromodel-sk) sa preskočí
      assert.equal(result.processedInBatch, 1);
      assert.equal(result.results[0].feedId, "zzz-obchod-sk");
      // počítadlá zdedené zo starého runu
      assert.equal(result.counts?.failedFeeds, 1);
      assert.equal(result.counts?.successfulFeeds, 1);
      // Run dobehol posledný feed → finalizuje sa ako success, aj keď má failed_feeds=1.
      // Inak by ho getOrCreateRun (status IN running/partial) resumoval donekonečna.
      assert.equal(result.status, "success");
    }

    // B. audit s freshRun=1 → nový run, počítadlá od nuly, bez checkpointu
    {
      const db = createFakeDb(
        [FEED_BEFORE_CHECKPOINT, FEED_AFTER_CHECKPOINT],
        [oldPartialRun("audit")]
      );
      const result = await importHeurekaBatch({
        mode: "audit",
        freshRun: true,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.notEqual(result.runId, OLD_RUN_ID);
      assert.equal(db.runs.length, 2); // starý + nový run
      // checkpoint nezačína hodnotou zo starého runu — spracoval sa aj feed
      // pred starým checkpointom
      assert.deepEqual(
        result.results.map((r) => r.feedId),
        ["aaa-obchod-sk", "zzz-obchod-sk"]
      );
      assert.equal(result.checkpoint, "zzz-obchod-sk");
      // počítadlá začali od nuly (bez zdedeného failed_feeds=1)
      assert.equal(result.counts?.successfulFeeds, 2);
      assert.equal(result.counts?.failedFeeds, 0);
      assert.equal(result.status, "success");
      // lock ďalej funguje
      assert.equal(result.lock.acquired, true);
      assert.ok(db.queries.some((q) => q.text.includes("INSERT INTO hk_import_locks")));
      assert.ok(db.queries.some((q) => q.text.includes("DELETE FROM hk_import_locks")));
      // starý partial run ostal nedotknutý
      const old = mustRun(db, OLD_RUN_ID);
      assert.equal(old.status, "partial");
      assert.equal(old.failed_feeds, 1);
      assert.equal(old.successful_feeds, 0);
      assert.equal(old.processed_feeds, 1);
      assert.equal(old.cursor_feed_id, "aeromodel-sk");
      assert.equal(old.error_summary, "aeromodel-sk: HTTP 500");
    }

    // C. full s freshRun=1 → freshRun ignorovaný, resume správanie nezmenené
    {
      const db = createFakeDb(
        [FEED_BEFORE_CHECKPOINT, FEED_AFTER_CHECKPOINT],
        [oldPartialRun("full")]
      );
      const result = await importHeurekaBatch({
        mode: "full",
        freshRun: true,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.equal(result.runId, OLD_RUN_ID); // pokračuje v starom rune
      assert.equal(db.runs.length, 1); // žiadny nový run nevznikol
      // pokračuje od checkpointu, nie od začiatku
      assert.equal(result.processedInBatch, 1);
      assert.equal(result.results[0].feedId, "zzz-obchod-sk");
      assert.equal(result.results[0].status, "success"); // full režim importuje
      // počítadlá zdedené
      assert.equal(result.counts?.failedFeeds, 1);
    }

    // D. fresh audit jedného zdravého feedu nad 100 položiek
    {
      const db = createFakeDb([FEED_AFTER_CHECKPOINT], []);
      const result = await importHeurekaBatch({
        mode: "audit",
        freshRun: true,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.equal(result.status, "success");
      assert.equal(result.counts?.successfulFeeds, 1);
      assert.equal(result.counts?.failedFeeds, 0);
      // feed status v API odpovedi
      assert.equal(result.results[0].status, "audit_success");
      assert.equal(result.results[0].sampled, true);
      assert.equal(result.results[0].sampleProductCount, HEUREKA_AUDIT_MAX_ITEMS);
      assert.equal(result.results[0].feedHasMoreItems, true);
      assert.equal(result.needsNextRequest, false);
      // žiadny zápis do hk_products
      assert.equal(db.queries.filter((q) => q.text.includes("hk_products")).length, 0);
      // žiadna aktualizácia hk_feeds (INSERT zo sync kroku je povolený,
      // UPDATE hk_feeds by menil error_count/last_error/product_count)
      assert.equal(db.queries.filter((q) => q.text.includes("UPDATE hk_feeds")).length, 0);
    }
  } finally {
    restore();
  }

  console.log("Heureka freshRun tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
