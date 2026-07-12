/**
 * Testy cieleného retry Heureka importu (mode=full + feedIds=...).
 *
 * Overuje:
 *  A. validateRetryFeedIds — trim, dedupe, sort, oddelenie neznámych ID
 *  B. neznáme feed ID → importHeurekaBatch odmietne request pred lockom aj runom
 *  C. mode=audit + feedIds → odmietnuté
 *  D. timeouty — bežný full ostáva 60 s, audit 60 s, retry ≥ 120 s a zmestí sa
 *     do request budgetu
 *  E. retry importuje IBA vybrané feedy, vytvorí nový run type='heureka_retry',
 *     starý partial full run ostáva nedotknutý
 *  F. retry run sa medzi requestami obnovuje (rovnaký feed set → rovnaký runId),
 *     bežný full request retry run NEadoptuje, iný feed set → nový retry run
 *  G. currency_code UPSERT cez COALESCE — NULL z parsera neprepíše existujúce
 *     EUR/CZK, explicitná nová mena starú hodnotu aktualizuje
 *  H. affiliate URL logika nezmenená — produkt dostane presne feed.affiliate_url
 *
 * DB je simulovaná in-memory fake sql klientom (options.sqlClient), feed fetch
 * je stubnutý — testy sa nedotýkajú produkčnej DB ani siete.
 *
 * Spustenie: npx tsx scripts/test-heureka-retry.ts
 */
import assert from "node:assert/strict";
import {
  getImportModeConfig,
  importHeurekaBatch,
  validateRetryFeedIds,
  type ImportHeurekaBatchOptions,
  type HkFeedImportRow,
} from "../lib/heureka/import.ts";
import {
  HEUREKA_FULL_FEED_TIMEOUT_MS,
  HEUREKA_RETRY_FEED_TIMEOUT_MS,
} from "../lib/heureka/config.ts";

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
  started_at: number;
}

interface FakeProduct {
  name: string;
  currency_code: string | null;
  affiliate_url: string | null;
}

interface FakeDb {
  feeds: HkFeedImportRow[];
  runs: FakeRun[];
  runFeeds: Map<string, Set<string>>;
  products: Map<string, FakeProduct>;
  upsertTexts: string[];
  queries: RecordedQuery[];
  seq: number;
}

function createFakeDb(feeds: HkFeedImportRow[], runs: FakeRun[]): FakeDb {
  return {
    feeds,
    runs,
    runFeeds: new Map(),
    products: new Map(),
    upsertTexts: [],
    queries: [],
    seq: runs.length + 1,
  };
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

  // finalizeRunIfDone / hasRemainingFeeds — počet feedov za checkpointom runu,
  // pri retry rune obmedzený na retry feed set (ANY)
  if (text.includes("AS remaining")) {
    const hasAny = text.includes("ANY(");
    const ids = hasAny ? (values[0] as string[]) : null;
    const runId = hasAny ? values[1] : values[0];
    const run = db.runs.find((r) => r.id === runId);
    const cursor = run?.cursor_feed_id ?? "";
    const remaining = db.feeds.filter(
      (f) => f.id > cursor && (!ids || ids.includes(f.id))
    ).length;
    return [{ remaining }];
  }

  if (text.includes("hk_import_run_feeds")) {
    if (text.includes("SELECT feed_id")) {
      const set = db.runFeeds.get(values[0] as string) ?? new Set<string>();
      return [...set].map((feed_id) => ({ feed_id }));
    }
    if (text.includes("FROM hk_feeds")) {
      // seed pending run_feeds — retry variant má ANY filter
      const [runId, ids] = values as [string, string[] | undefined];
      const set = db.runFeeds.get(runId) ?? new Set<string>();
      for (const feed of db.feeds) {
        if (!ids || ids.includes(feed.id)) set.add(feed.id);
      }
      db.runFeeds.set(runId, set);
      return [];
    }
    // setRunFeedStatus
    const [runId, feedId] = values as [string, string];
    const set = db.runFeeds.get(runId) ?? new Set<string>();
    set.add(feedId);
    db.runFeeds.set(runId, set);
    return [];
  }

  if (text.includes("INSERT INTO hk_products")) {
    // Emulácia ON CONFLICT (url) DO UPDATE vrátane COALESCE semantiky pre
    // currency_code — test padne, ak sa UPSERT vráti k EXCLUDED.currency_code.
    const coalesce = text.includes("COALESCE(EXCLUDED.currency_code, hk_products.currency_code)");
    db.upsertTexts.push(text);
    const names = values[1] as string[];
    const currencies = values[4] as (string | null)[];
    const urls = values[5] as string[];
    const affs = values[9] as (string | null)[];
    urls.forEach((url, i) => {
      const existing = db.products.get(url);
      const incoming = currencies[i] ?? null;
      const currency_code = existing && coalesce ? incoming ?? existing.currency_code : incoming;
      db.products.set(url, { name: names[i], currency_code, affiliate_url: affs[i] ?? null });
    });
    return [];
  }

  if (text.includes("hk_import_runs")) {
    if (text.includes("INSERT INTO hk_import_runs")) {
      let run: FakeRun;
      if (text.includes("'heureka'")) {
        const [id, mode, totalFeeds] = values as [string, string, number];
        run = {
          id, type: "heureka", mode, status: "running",
          total_feeds: totalFeeds, processed_feeds: 0, successful_feeds: 0,
          failed_feeds: 0, cursor_feed_id: null, error_summary: null,
          started_at: db.seq++,
        };
      } else {
        // retry run: VALUES ($id, $type, 'full', 'running', ...)
        const [id, type, totalFeeds] = values as [string, string, number];
        run = {
          id, type, mode: "full", status: "running",
          total_feeds: totalFeeds, processed_feeds: 0, successful_feeds: 0,
          failed_feeds: 0, cursor_feed_id: null, error_summary: null,
          started_at: db.seq++,
        };
      }
      db.runs.push(run);
      return [projectRun(run)];
    }
    if (text.includes("status IN ('running', 'partial')")) {
      const typeFilter = text.includes("type = 'heureka'") ? "heureka" : (values[0] as string);
      const active = [...db.runs]
        .filter((r) => r.type === typeFilter && (r.status === "running" || r.status === "partial"))
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
    if (text.includes("COUNT(*)::int AS total")) {
      if (text.includes("ANY(")) {
        const ids = values[0] as string[];
        return [{ total: db.feeds.filter((f) => ids.includes(f.id)).length }];
      }
      return [{ total: db.feeds.length }];
    }
    if (text.includes("UPDATE hk_feeds")) return []; // full režim zapisuje výsledok feedu
    // selectNextFeeds — retry variant má ANY filter na feed set
    const sorted = [...db.feeds].sort((a, b) => (a.id < b.id ? -1 : 1));
    if (text.includes("ANY(")) {
      if (text.includes("id > $?")) {
        const [ids, cursor, limit] = values as [string[], string, number];
        return sorted.filter((f) => ids.includes(f.id) && f.id > cursor).slice(0, limit);
      }
      const [ids, limit] = values as [string[], number];
      return sorted.filter((f) => ids.includes(f.id)).slice(0, limit);
    }
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

// ── mock fetch: každý feed vráti 2 produkty s URL odvodenými od feed ID ──
function feedXmlFor(feedId: string, count = 2): string {
  const items = Array.from(
    { length: count },
    (_, i) =>
      `<SHOPITEM><PRODUCTNAME>Produkt ${feedId} ${i}</PRODUCTNAME><URL>https://${feedId}.example/p/${i}</URL><PRICE_VAT>19.90</PRICE_VAT></SHOPITEM>`
  ).join("");
  return `<?xml version="1.0" encoding="utf-8"?><SHOP>${items}</SHOP>`;
}

const fetchedUrls: string[] = [];

function stubFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchedUrls.push(url);
    const feedId = url.replace("https://feeds.example/", "").replace(".xml", "");
    return new Response(feedXmlFor(feedId));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

// Fake DB feedy používajú REÁLNE feed ID z HEUREKA_FEEDS (whitelist by inak
// retry odmietol), ale fake URL/domény. Doména mimo .sk/.cz + cena bez symbolu
// meny → resolveProductCurrency vráti null (test COALESCE).
function makeFeed(id: string, overrides: Partial<HkFeedImportRow> = {}): HkFeedImportRow {
  return {
    id,
    url: `https://feeds.example/${id}.xml`,
    domain: `${id}.example`,
    category: "test",
    affiliate_url: null,
    currency_code: null,
    enabled: true,
    ...overrides,
  };
}

const AFFIAL_URL = "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=test";

const FEED_AERO = makeFeed("aeromodel-sk", { affiliate_url: AFFIAL_URL });
const FEED_BELDA = makeFeed("belda-sk");
const FEED_KULINA = makeFeed("kulina-sk");

const OLD_RUN_ID = "abca4a64-old-partial-full";

function oldPartialFullRun(): FakeRun {
  return {
    id: OLD_RUN_ID,
    type: "heureka",
    mode: "full",
    status: "partial",
    total_feeds: 3,
    processed_feeds: 1,
    successful_feeds: 0,
    failed_feeds: 1,
    cursor_feed_id: "aeromodel-sk",
    error_summary: "aeromodel-sk: The operation was aborted due to timeout",
    started_at: 1,
  };
}

async function run() {
  const restore = stubFetch();

  try {
    // A. validateRetryFeedIds — trim, dedupe, sort, neznáme ID zvlášť
    {
      const { valid, unknown } = validateRetryFeedIds([
        "kulina-sk", " aeromodel-sk ", "kulina-sk", "not-a-feed", "", "not-a-feed",
      ]);
      assert.deepEqual(valid, ["aeromodel-sk", "kulina-sk"]);
      assert.deepEqual(unknown, ["not-a-feed"]);
    }

    // B. neznáme feed ID → odmietnuté pred lockom, žiadny run nevznikol
    {
      const db = createFakeDb([FEED_AERO, FEED_BELDA, FEED_KULINA], []);
      await assert.rejects(
        importHeurekaBatch({
          mode: "full",
          feedIds: ["aeromodel-sk", "nope-xx"],
          sqlClient: createFakeSql(db),
        }),
        /nope-xx/
      );
      assert.equal(db.queries.length, 0); // validácia prebehla pred prvým SQL dotazom
      assert.equal(db.runs.length, 0);
    }

    // C. mode=audit + feedIds → odmietnuté
    {
      const db = createFakeDb([FEED_AERO], []);
      await assert.rejects(
        importHeurekaBatch({
          mode: "audit",
          feedIds: ["aeromodel-sk"],
          sqlClient: createFakeSql(db),
        }),
        /mode=full/
      );
      assert.equal(db.queries.length, 0);
    }

    // D. timeouty — full/audit nezmenené, retry vyšší a v medziach budgetu
    {
      assert.equal(HEUREKA_FULL_FEED_TIMEOUT_MS, 60_000);
      assert.equal(getImportModeConfig("full").feedTimeoutMs, 60_000);
      assert.equal(getImportModeConfig("audit").feedTimeoutMs, 60_000);

      const retryCfg = getImportModeConfig("full", true);
      assert.equal(retryCfg.feedTimeoutMs, HEUREKA_RETRY_FEED_TIMEOUT_MS);
      assert.ok(retryCfg.feedTimeoutMs >= 120_000, "retry timeout musí byť aspoň 120 s");
      // dlhý feed sa nesmie začať tesne pred koncom request budgetu
      assert.ok(retryCfg.minRemainingMs >= retryCfg.feedTimeoutMs);
      assert.ok(retryCfg.feedTimeoutMs + 30_000 <= retryCfg.requestBudgetMs);
    }

    // E. retry iba vybraných feedov — nový retry run, starý partial nedotknutý
    {
      fetchedUrls.length = 0;
      const db = createFakeDb([FEED_AERO, FEED_BELDA, FEED_KULINA], [oldPartialFullRun()]);
      const result = await importHeurekaBatch({
        mode: "full",
        feedIds: ["kulina-sk", "aeromodel-sk"],
        batchSize: 10,
        parallelism: 1,
        sqlClient: createFakeSql(db),
      });

      assert.equal(result.ok, true);
      assert.equal(result.retry, true);
      assert.deepEqual(result.retryFeedIds, ["aeromodel-sk", "kulina-sk"]);
      // nový samostatný run, nie pokračovanie starého partial runu
      assert.notEqual(result.runId, OLD_RUN_ID);
      const newRun = mustRun(db, result.runId);
      assert.equal(newRun.type, "heureka_retry");
      assert.equal(newRun.mode, "full");
      assert.equal(result.counts?.totalFeeds, 2);
      // spracovali sa IBA vybrané feedy (belda-sk sa nedotkol)
      assert.deepEqual(
        result.results.map((r) => r.feedId),
        ["aeromodel-sk", "kulina-sk"]
      );
      assert.ok(result.results.every((r) => r.status === "success"));
      assert.equal(result.status, "success");
      assert.equal(result.needsNextRequest, false);
      assert.deepEqual(
        [...fetchedUrls].sort(),
        [FEED_AERO.url, FEED_KULINA.url].sort()
      );
      assert.ok(db.products.has("https://aeromodel-sk.example/p/0"));
      assert.ok(!db.products.has("https://belda-sk.example/p/0"));
      // starý partial run ostal nedotknutý
      const old = mustRun(db, OLD_RUN_ID);
      assert.equal(old.status, "partial");
      assert.equal(old.processed_feeds, 1);
      assert.equal(old.successful_feeds, 0);
      assert.equal(old.failed_feeds, 1);
      assert.equal(old.cursor_feed_id, "aeromodel-sk");
      assert.equal(old.error_summary, "aeromodel-sk: The operation was aborted due to timeout");
      // lock sa získal aj uvoľnil
      assert.ok(db.queries.some((q) => q.text.includes("INSERT INTO hk_import_locks")));
      assert.ok(db.queries.some((q) => q.text.includes("DELETE FROM hk_import_locks")));
      // H. affiliate URL logika nezmenená
      assert.equal(
        db.products.get("https://aeromodel-sk.example/p/0")?.affiliate_url,
        AFFIAL_URL
      );
      assert.ok(db.upsertTexts.every((t) => t.includes("affiliate_url = EXCLUDED.affiliate_url")));
    }

    // F. resume retry runu + izolácia od bežného full importu
    {
      const db = createFakeDb([FEED_AERO, FEED_BELDA, FEED_KULINA], []);
      const sqlClient = createFakeSql(db);

      const r1 = await importHeurekaBatch({
        mode: "full",
        feedIds: ["aeromodel-sk", "kulina-sk"],
        batchSize: 1,
        parallelism: 1,
        sqlClient,
      });
      assert.equal(r1.processedInBatch, 1);
      assert.equal(r1.results[0].feedId, "aeromodel-sk");
      assert.equal(r1.status, "partial");
      assert.equal(r1.needsNextRequest, true);

      // bežný full request (denný cron) retry run NEadoptuje — založí vlastný
      const rCron = await importHeurekaBatch({ mode: "full", batchSize: 1, sqlClient });
      assert.notEqual(rCron.runId, r1.runId);
      assert.equal(mustRun(db, rCron.runId).type, "heureka");

      // ďalší retry request s rovnakým feed setom pokračuje v retry rune
      const r2 = await importHeurekaBatch({
        mode: "full",
        feedIds: ["aeromodel-sk", "kulina-sk"],
        batchSize: 1,
        parallelism: 1,
        sqlClient,
      });
      assert.equal(r2.runId, r1.runId);
      assert.equal(r2.results[0].feedId, "kulina-sk");
      assert.equal(r2.status, "success");
      assert.equal(r2.needsNextRequest, false);
      assert.equal(r2.counts?.processedFeeds, 2);
    }

    // F2. aktívny retry run s iným feed setom sa neobnoví — vznikne nový run
    {
      const db = createFakeDb([FEED_AERO, FEED_BELDA, FEED_KULINA], []);
      const staleRetry: FakeRun = {
        id: "stale-retry-run",
        type: "heureka_retry",
        mode: "full",
        status: "partial",
        total_feeds: 1,
        processed_feeds: 0,
        successful_feeds: 0,
        failed_feeds: 0,
        cursor_feed_id: null,
        error_summary: null,
        started_at: 1,
      };
      db.runs.push(staleRetry);
      db.runFeeds.set(staleRetry.id, new Set(["aeromodel-sk"]));

      const result = await importHeurekaBatch({
        mode: "full",
        feedIds: ["kulina-sk"],
        batchSize: 1,
        sqlClient: createFakeSql(db),
      });
      assert.notEqual(result.runId, staleRetry.id);
      assert.equal(mustRun(db, result.runId).type, "heureka_retry");
      assert.deepEqual(result.results.map((r) => r.feedId), ["kulina-sk"]);
    }

    // G. currency_code cez COALESCE — NULL neprepíše známu menu,
    //    explicitná nová mena áno
    {
      fetchedUrls.length = 0;
      // kulina-sk dostane vo feed row explicitnú menu CZK
      const kulinaCzk = makeFeed("kulina-sk", { currency_code: "CZK" });
      const db = createFakeDb([FEED_AERO, kulinaCzk], []);
      // existujúce produkty so známou menou (z predchádzajúceho úspešného importu)
      db.products.set("https://aeromodel-sk.example/p/0", {
        name: "starý", currency_code: "EUR", affiliate_url: null,
      });
      db.products.set("https://aeromodel-sk.example/p/1", {
        name: "starý", currency_code: "CZK", affiliate_url: null,
      });
      db.products.set("https://kulina-sk.example/p/0", {
        name: "starý", currency_code: "EUR", affiliate_url: null,
      });

      const result = await importHeurekaBatch({
        mode: "full",
        feedIds: ["aeromodel-sk", "kulina-sk"],
        batchSize: 10,
        sqlClient: createFakeSql(db),
      });
      assert.equal(result.ok, true);

      // aeromodel: doména .example + cena bez symbolu → parser/resolver vráti
      // NULL → existujúca mena musí zostať zachovaná
      assert.equal(db.products.get("https://aeromodel-sk.example/p/0")?.currency_code, "EUR");
      assert.equal(db.products.get("https://aeromodel-sk.example/p/1")?.currency_code, "CZK");
      // kulina: explicitná mena CZK z feed row prepíše staré EUR…
      assert.equal(db.products.get("https://kulina-sk.example/p/0")?.currency_code, "CZK");
      // …a nový kulina produkt ju dostane rovno
      assert.equal(db.products.get("https://kulina-sk.example/p/1")?.currency_code, "CZK");
      assert.ok(db.upsertTexts.length > 0);
      assert.ok(
        db.upsertTexts.every((t) =>
          t.includes("currency_code = COALESCE(EXCLUDED.currency_code, hk_products.currency_code)")
        ),
        "UPSERT musí používať COALESCE pre currency_code"
      );
    }
  } finally {
    restore();
  }

  console.log("Heureka retry tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
