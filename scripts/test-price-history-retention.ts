/**
 * Testy retencie a monitoringu cenovej histórie.
 *
 * RETENCIA (cleanupPriceHistory):
 *  A. nič staršie než 120 dní → deletedRows=0, batches=1, hasMore=false
 *  B. riadky 119 dní staré zostanú, >120 dní sa zmažú
 *  C. presná hranica retencie (presne 120 dní) → riadok zostáva (recorded_at < cutoff je striktné)
 *  D. batchSize sa dodrží (žiadna dávka nezmaže viac než batchSize)
 *  E. maxBatches sa dodrží → hasMore=true pri zostávajúcom backlogu
 *  F. opakovaný cleanup je idempotentný (druhý beh zmaže 0)
 *
 * MONITORING (getPriceHistoryStats):
 *  G. agregácie sa správne namapujú (bigint-as-string → number), 7-dňový rast
 *  H. prázdna tabuľka → nuly a null timestampy
 *
 * ENDPOINT (POST /api/admin/price-history-cleanup):
 *  I. bez secretu → 401
 *  J. nesprávny secret → 401
 *  K. správny secret → prejde autorizáciou (DB nedostupná → 500 generic bez úniku secretu)
 *
 * DB je stubnutá in-memory — bez produkčnej DB a siete.
 * Spustenie: npx tsx scripts/test-price-history-retention.ts
 */
import assert from "node:assert/strict";
import {
  cleanupPriceHistory,
  type CleanupOptions,
} from "../lib/heureka/price-history-retention.ts";
import { getPriceHistoryStats } from "../lib/heureka/price-history.ts";

type SqlClient = NonNullable<CleanupOptions["sqlClient"]>;

const DAY_MS = 24 * 60 * 60 * 1000;

interface HistRow {
  id: number;
  recorded_at: number; // epoch ms
}

interface HistStore {
  rows: HistRow[];
}

// Fixný referenčný „teraz" — determinuje hranicu retencie bez ms driftu.
const NOW = Date.parse("2026-07-13T07:00:00Z");

function rowAgedDays(id: number, daysOld: number): HistRow {
  return { id, recorded_at: NOW - daysOld * DAY_MS };
}

// Mock sql: interpretuje DELETE ... WHERE recorded_at < now()-interval ... LIMIT n
// proti in-memory store. Poradie hodnôt v šablóne: [retentionDays, batchSize].
function createCleanupMockSql(store: HistStore): SqlClient {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("$?");
    if (text.includes("DELETE FROM product_price_history")) {
      const retentionDays = values[0] as number;
      const batchSize = values[1] as number;
      const cutoff = NOW - retentionDays * DAY_MS;
      const victims = store.rows
        .filter((r) => r.recorded_at < cutoff) // striktne — hranica ostáva
        .sort((a, b) => a.recorded_at - b.recorded_at) // najstaršie prvé
        .slice(0, batchSize);
      const ids = new Set(victims.map((v) => v.id));
      store.rows = store.rows.filter((r) => !ids.has(r.id));
      return Promise.resolve(victims.map((v) => ({ id: v.id })));
    }
    return Promise.resolve([]);
  };
  return sql as unknown as SqlClient;
}

function createStatsMockSql(
  agg: Record<string, unknown>,
  daily: Array<{ day: string; rows: number }>
): SqlClient {
  const sql = (strings: TemplateStringsArray) => {
    const text = strings.join("$?");
    if (text.includes("rows_older_than_retention")) return Promise.resolve([agg]);
    if (text.includes("recorded_day::text AS day")) return Promise.resolve(daily);
    return Promise.resolve([]);
  };
  return sql as unknown as SqlClient;
}

async function run() {
  // A. nič staršie než 120 dní → deletedRows=0
  {
    const store: HistStore = { rows: [rowAgedDays(1, 0), rowAgedDays(2, 50), rowAgedDays(3, 119)] };
    const r = await cleanupPriceHistory({
      retentionDays: 120,
      batchSize: 100,
      maxBatches: 5,
      sqlClient: createCleanupMockSql(store),
    });
    assert.equal(r.deletedRows, 0);
    assert.equal(r.batches, 1);
    assert.equal(r.hasMore, false);
    assert.equal(r.retentionDays, 120);
    assert.equal(store.rows.length, 3, "nič sa nesmie zmazať");
  }

  // B. 119 dní zostáva, >120 dní sa zmaže
  {
    const store: HistStore = {
      rows: [rowAgedDays(1, 100), rowAgedDays(2, 119), rowAgedDays(3, 121), rowAgedDays(4, 200)],
    };
    const r = await cleanupPriceHistory({
      retentionDays: 120,
      batchSize: 100,
      maxBatches: 5,
      sqlClient: createCleanupMockSql(store),
    });
    assert.equal(r.deletedRows, 2, "121 a 200 dní sa zmažú");
    assert.equal(r.hasMore, false);
    const remaining = store.rows.map((x) => x.id).sort();
    assert.deepEqual(remaining, [1, 2], "100 a 119 dní zostávajú");
  }

  // C. presná hranica: presne 120 dní → riadok zostáva (striktné <)
  {
    const store: HistStore = { rows: [rowAgedDays(1, 120), rowAgedDays(2, 120.5)] };
    const r = await cleanupPriceHistory({
      retentionDays: 120,
      batchSize: 100,
      maxBatches: 5,
      sqlClient: createCleanupMockSql(store),
    });
    assert.equal(r.deletedRows, 1, "iba 120.5 dňa sa zmaže");
    assert.deepEqual(store.rows.map((x) => x.id), [1], "presne 120 dní zostáva");
  }

  // D. batchSize sa dodrží: 25 starých riadkov, batchSize=10 → 3 dávky (10+10+5)
  {
    const store: HistStore = { rows: Array.from({ length: 25 }, (_, i) => rowAgedDays(i + 1, 200)) };
    const r = await cleanupPriceHistory({
      retentionDays: 120,
      batchSize: 10,
      maxBatches: 20,
      sqlClient: createCleanupMockSql(store),
    });
    assert.equal(r.deletedRows, 25);
    assert.equal(r.batches, 3, "10 + 10 + 5");
    assert.equal(r.hasMore, false, "posledná dávka 5 < 10 → backlog vyčerpaný");
    assert.equal(store.rows.length, 0);
  }

  // E. maxBatches sa dodrží → hasMore=true pri zostávajúcom backlogu
  {
    const store: HistStore = { rows: Array.from({ length: 100 }, (_, i) => rowAgedDays(i + 1, 200)) };
    const r = await cleanupPriceHistory({
      retentionDays: 120,
      batchSize: 10,
      maxBatches: 3,
      sqlClient: createCleanupMockSql(store),
    });
    assert.equal(r.batches, 3, "zastaví po maxBatches");
    assert.equal(r.deletedRows, 30);
    assert.equal(r.hasMore, true, "posledná dávka plná → zostáva backlog");
    assert.equal(store.rows.length, 70, "70 riadkov zostáva na ďalší request");
  }

  // F. idempotentný: druhý beh nad tým istým store zmaže 0
  {
    const store: HistStore = { rows: [rowAgedDays(1, 50), rowAgedDays(2, 200)] };
    const mock = createCleanupMockSql(store);
    const r1 = await cleanupPriceHistory({ retentionDays: 120, batchSize: 100, maxBatches: 5, sqlClient: mock });
    const r2 = await cleanupPriceHistory({ retentionDays: 120, batchSize: 100, maxBatches: 5, sqlClient: mock });
    assert.equal(r1.deletedRows, 1);
    assert.equal(r2.deletedRows, 0, "opakovaný cleanup je idempotentný");
    assert.equal(r2.batches, 1);
    assert.equal(r2.hasMore, false);
  }

  // G. monitoring: agregácie (bigint-as-string) → number + 7-dňový rast
  {
    const stats = await getPriceHistoryStats(
      createStatsMockSql(
        {
          total_rows: "87404",
          distinct_products: "87404",
          distinct_days: 1,
          oldest_recorded_at: "2026-07-12T07:00:00.000Z",
          newest_recorded_at: "2026-07-12T07:05:00.000Z",
          latest_recorded_day: "2026-07-12",
          latest_day_rows: "87404",
          rows_older_than_retention: "0",
        },
        [{ day: "2026-07-12", rows: 87404 }]
      )
    );
    assert.equal(stats.totalRows, 87404);
    assert.equal(typeof stats.totalRows, "number");
    assert.equal(stats.distinctProducts, 87404);
    assert.equal(stats.distinctDays, 1);
    assert.equal(stats.latestRecordedDay, "2026-07-12");
    assert.equal(stats.latestDayRows, 87404);
    assert.equal(stats.rowsOlderThan120Days, 0);
    assert.equal(stats.last7Days.length, 1);
    assert.equal(stats.last7Days[0].rows, 87404);
  }

  // H. prázdna tabuľka → nuly a null timestampy
  {
    const stats = await getPriceHistoryStats(
      createStatsMockSql(
        {
          total_rows: "0",
          distinct_products: "0",
          distinct_days: 0,
          oldest_recorded_at: null,
          newest_recorded_at: null,
          latest_recorded_day: null,
          latest_day_rows: "0",
          rows_older_than_retention: "0",
        },
        []
      )
    );
    assert.equal(stats.totalRows, 0);
    assert.equal(stats.oldestRecordedAt, null);
    assert.equal(stats.newestRecordedAt, null);
    assert.equal(stats.latestRecordedDay, null);
    assert.equal(stats.last7Days.length, 0);
  }

  // ── ENDPOINT auth ──
  const { POST } = await import("../app/api/admin/price-history-cleanup/route.ts");
  const url = "https://www.zlavickovo.sk/api/admin/price-history-cleanup";
  const makeReq = (headers: Record<string, string>) =>
    new Request(url, { method: "POST", headers }) as any;

  const origSecret = process.env.CRON_SECRET;
  const origDbUrl = process.env.DATABASE_URL;
  process.env.CRON_SECRET = "test-secret";

  // I. bez secretu → 401
  {
    const res = await POST(makeReq({}));
    assert.equal(res.status, 401);
  }

  // J. nesprávny secret → 401
  {
    const res = await POST(makeReq({ authorization: "Bearer wrong" }));
    assert.equal(res.status, 401);
  }

  // K. správny secret → prejde autorizáciou; DB nedostupná → 500 generic bez úniku
  {
    delete process.env.DATABASE_URL; // getDb() vyhodí → catch → 500
    const res = await POST(makeReq({ authorization: "Bearer test-secret" }));
    assert.notEqual(res.status, 401, "autorizácia musí prejsť");
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "Price history cleanup failed", "generická chyba — žiadny secret/DATABASE_URL");
    assert.ok(!JSON.stringify(body).includes("test-secret"), "secret sa nesmie objaviť v odpovedi");
  }

  process.env.CRON_SECRET = origSecret;
  if (origDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = origDbUrl;

  console.log("Price history retention + monitoring tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
