/**
 * Testy lifecycle Heureka importného runu (importHeurekaBatch → finalizeRunIfDone).
 *
 * Fix: resumovaný running/partial run bez zostávajúcich feedov sa musí finalizovať
 * ako success (finished_at=now()), inak ho getOrCreateRun (status IN running/partial,
 * bez kontroly finished_at) resumuje donekonečna a nový import sa nikdy nezaloží.
 *
 * Overuje:
 *  A. partial run + zostávajúce feedy → status ostáva partial, finished_at null,
 *     needsNextRequest=true
 *  B. partial run + checkpoint na poslednom feede → success, finished_at sa nastaví,
 *     needsNextRequest=false, processedInBatch=0
 *  C. processedInBatch=0 + žiadne feedy + failed_feeds>0 (reprodukcia produkčného
 *     stuck runu) → success, NIE partial
 *  D. nasledujúci request po success rune → nový runId, checkpoint od začiatku,
 *     vyberie prvé feedy, processedInBatch>0
 *  E. súbežný request (lock nezískaný) → status='locked', needsNextRequest=true,
 *     ok=false, lock správanie nezmenené
 *
 * DB je simulovaná in-memory fake sql klientom (options.sqlClient), feed fetch
 * je stubnutý — testy sa nedotýkajú produkčnej DB ani siete.
 *
 * Spustenie: npx tsx scripts/test-heureka-lifecycle.ts
 */
import assert from "node:assert/strict";
import {
  importHeurekaBatch,
  type ImportHeurekaBatchOptions,
  type HkFeedImportRow,
} from "../lib/heureka/import.ts";

type SqlClient = NonNullable<ImportHeurekaBatchOptions["sqlClient"]>;

interface RecordedQuery {
  text: string;
  values: unknown[];
}

interface FakeRun {
  id: string;
  type: string;
  mode: string;
  status: string;
  total_feeds: number;
  processed_feeds: number;
  successful_feeds: number;
  failed_feeds: number;
  cursor_feed_id: string | null;
  error_summary: string | null;
  finished_at: string | null;
  started_at: number;
}

interface FakeDb {
  feeds: HkFeedImportRow[];
  runs: FakeRun[];
  queries: RecordedQuery[];
  seq: number;
  lockAcquirable: boolean;
}

function createFakeDb(
  feeds: HkFeedImportRow[],
  runs: FakeRun[],
  lockAcquirable = true
): FakeDb {
  return { feeds, runs, queries: [], seq: runs.length + 1, lockAcquirable };
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
      // Súbežný request: lock drží iný beh → prázdny result (acquired=false)
      return db.lockAcquirable
        ? [{ expires_at: new Date(Date.now() + 600_000).toISOString() }]
        : [];
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
  if (text.includes("product_price_history")) return []; // cenový snapshot (full režim)

  if (text.includes("hk_import_runs")) {
    if (text.includes("INSERT INTO hk_import_runs")) {
      const [id, mode, totalFeeds] = values as [string, string, number];
      const run: FakeRun = {
        id,
        type: "heureka",
        mode,
        status: "running",
        total_feeds: totalFeeds,
        processed_feeds: 0,
        successful_feeds: 0,
        failed_feeds: 0,
        cursor_feed_id: null,
        error_summary: null,
        finished_at: null,
        started_at: db.seq++,
      };
      db.runs.push(run);
      return [projectRun(run)];
    }
    if (text.includes("status IN ('running', 'partial')")) {
      const active = [...db.runs]
        .filter((r) => r.type === "heureka" && (r.status === "running" || r.status === "partial"))
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
      const run = mustRun(db, values[1]);
      run.status = "error";
      run.finished_at = new Date().toISOString();
      return [];
    }
    if (text.includes("SET status = 'success'")) {
      // finalizeRunIfDone: remaining=0 → vždy success + finished_at
      const run = mustRun(db, values[0]);
      run.status = "success";
      run.finished_at = new Date().toISOString();
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

function feedXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?><SHOP><SHOPITEM><PRODUCTNAME>P</PRODUCTNAME><URL>https://shop.example/p/1</URL><PRICE_VAT>19.90</PRICE_VAT></SHOPITEM></SHOP>`;
}

function stubFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(feedXml())) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function makeFeed(id: string): HkFeedImportRow {
  return {
    id,
    url: `https://feeds.example/${id}.xml`,
    domain: `${id}.example`,
    category: "test",
    affiliate_url: null,
    currency_code: null,
    enabled: true,
  };
}

// Alfabeticky: aaa < zzz. "zzz-obchod-sk" je vždy posledný feed (checkpoint edge).
const FEED_FIRST = makeFeed("aaa-obchod-sk");
const FEED_LAST = makeFeed("zzz-obchod-sk");

function partialRun(overrides: Partial<FakeRun> = {}): FakeRun {
  return {
    id: "old-partial-run",
    type: "heureka",
    mode: "full",
    status: "partial",
    total_feeds: 2,
    processed_feeds: 1,
    successful_feeds: 1,
    failed_feeds: 0,
    cursor_feed_id: null,
    error_summary: null,
    finished_at: null,
    started_at: 1,
    ...overrides,
  };
}

async function run() {
  const restore = stubFetch();

  try {
    // A. partial run + zostávajúce feedy → ostáva partial, finished_at null, needsNext=true
    {
      const db = createFakeDb([FEED_FIRST, FEED_LAST], [partialRun({ cursor_feed_id: null })]);
      const result = await importHeurekaBatch({
        mode: "full",
        batchSize: 1,
        parallelism: 1,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.equal(result.runId, "old-partial-run");
      assert.equal(result.processedInBatch, 1);
      assert.equal(result.results[0].feedId, "aaa-obchod-sk"); // od začiatku
      assert.equal(result.status, "partial");
      assert.equal(result.needsNextRequest, true);
      const r = mustRun(db, "old-partial-run");
      assert.equal(r.status, "partial");
      assert.equal(r.finished_at, null); // NEfinalizovaný
    }

    // B. partial run + checkpoint na poslednom feede → success, finished_at set, needsNext=false
    {
      const db = createFakeDb(
        [FEED_FIRST, FEED_LAST],
        [partialRun({ cursor_feed_id: "zzz-obchod-sk", processed_feeds: 2 })]
      );
      const result = await importHeurekaBatch({
        mode: "full",
        batchSize: 6,
        parallelism: 1,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.equal(result.runId, "old-partial-run");
      assert.equal(result.processedInBatch, 0); // za checkpointom nič nie je
      assert.equal(result.status, "success");
      assert.equal(result.needsNextRequest, false);
      const r = mustRun(db, "old-partial-run");
      assert.equal(r.status, "success");
      assert.ok(r.finished_at, "finished_at sa musí nastaviť");
    }

    // C. processedInBatch=0 + žiadne feedy + failed_feeds>0 (produkčný stuck run)
    //    → success, NIE partial
    {
      const db = createFakeDb(
        [FEED_FIRST, FEED_LAST],
        [
          partialRun({
            cursor_feed_id: "zzz-obchod-sk",
            processed_feeds: 2,
            successful_feeds: 0,
            failed_feeds: 2,
            error_summary: "zzz-obchod-sk: The operation was aborted due to timeout",
          }),
        ]
      );
      const result = await importHeurekaBatch({
        mode: "full",
        batchSize: 6,
        parallelism: 1,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.processedInBatch, 0);
      assert.equal(result.status, "success"); // kľúčové: failed_feeds>0 už NEznamená partial
      assert.equal(result.needsNextRequest, false);
      assert.equal(result.counts?.failedFeeds, 2); // zlyhania ostávajú vo počítadle
      const r = mustRun(db, "old-partial-run");
      assert.equal(r.status, "success");
      assert.ok(r.finished_at);
    }

    // D. nasledujúci request po success rune → nový runId, od začiatku, processedInBatch>0
    {
      const successRun: FakeRun = partialRun({
        id: "finished-success-run",
        status: "success",
        cursor_feed_id: "zzz-obchod-sk",
        processed_feeds: 2,
        finished_at: new Date().toISOString(),
      });
      const db = createFakeDb([FEED_FIRST, FEED_LAST], [successRun]);
      const result = await importHeurekaBatch({
        mode: "full",
        batchSize: 1,
        parallelism: 1,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.notEqual(result.runId, "finished-success-run"); // NEresumuje success run
      assert.equal(db.runs.length, 2); // starý success + nový run
      assert.ok(result.processedInBatch > 0);
      assert.equal(result.results[0].feedId, "aaa-obchod-sk"); // checkpoint od začiatku
      assert.equal(result.checkpoint, "aaa-obchod-sk");
      assert.equal(result.needsNextRequest, true); // ešte ostáva zzz
      // starý success run ostal nedotknutý
      const old = mustRun(db, "finished-success-run");
      assert.equal(old.status, "success");
    }

    // E. súbežný request (lock nezískaný) → locked, správanie nezmenené
    {
      const db = createFakeDb([FEED_FIRST, FEED_LAST], [], /* lockAcquirable */ false);
      const result = await importHeurekaBatch({
        mode: "full",
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, false);
      assert.equal(result.status, "locked");
      assert.equal(result.runId, null);
      assert.equal(result.processedInBatch, 0);
      assert.equal(result.needsNextRequest, true);
      assert.equal(result.lock.acquired, false);
      assert.equal(db.runs.length, 0); // žiadny run sa nezaložil
    }
  } finally {
    restore();
  }

  console.log("Heureka lifecycle tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
