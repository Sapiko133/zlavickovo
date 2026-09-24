/**
 * Feed engine — idempotencia, ochrana proti prázdnemu/podozrivému feedu,
 * retry/backoff, podmienené requesty, adaptívny interval, dry-run, verziované čítanie.
 * Spustenie: npx tsx scripts/test-feed-engine.ts  (bez siete, in-memory KV)
 */
import assert from "node:assert/strict";
import { createMemoryKv } from "../lib/kv.ts";
import {
  clearSnapshotMemo,
  DROP_CONFIRMATIONS,
  FEED_META_KEY,
  feedVersionKey,
  isFeedDue,
  readVersionedSnapshot,
  runFeed,
  type FeedMeta,
  type FeedSourceDef,
  type FetchResult,
} from "../lib/feeds/engine.ts";
import { classifyError, cooldownMinutes, FeedError, isRetryable, withRetry } from "../lib/feeds/fetch.ts";

interface Item { id: string; title: string; ok?: boolean }

const noSleep = async () => {};
let clock = Date.parse("2026-09-24T08:00:00Z");
const now = () => clock;

function source(fetchImpl: (n: number) => Promise<FetchResult<Item>>, extra: Partial<FeedSourceDef<Item>> = {}): FeedSourceDef<Item> & { calls: number } {
  const def = {
    id: "test-feed",
    provider: "test",
    label: "Test feed",
    url: "https://example.test/feed",
    format: "json-api" as const,
    tier: "high" as const,
    baseIntervalMin: 180,
    maxIntervalMin: 720,
    snapshotKey: "test:snapshot",
    affects: ["coupons" as const],
    configured: () => true,
    calls: 0,
    fetch() {
      def.calls++;
      return fetchImpl(def.calls);
    },
    itemKey: (i: Item) => i.id,
    isValidItem: (i: Item) => i.ok !== false && Boolean(i.id),
    ...extra,
  };
  return def;
}

const items = (n: number, prefix = "t") => Array.from({ length: n }, (_, i) => ({ id: `${i}`, title: `${prefix}${i}` }));

async function meta(kv: ReturnType<typeof createMemoryKv>): Promise<FeedMeta> {
  return (await kv.hget<FeedMeta>(FEED_META_KEY, "test-feed"))!;
}

async function main() {
// ── 1. Rovnaký feed 2× → žiadne duplicity, druhý beh bez zápisu snapshotu ──
{
  const kv = createMemoryKv();
  const def = source(async () => ({ items: [...items(30), { id: "5", title: "t5" }] })); // duplicitné ID v rámci feedu
  const r1 = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r1.status, "updated");
  assert.equal(r1.items, 30, "duplicitné ID sa zlúčia");
  assert.equal(r1.duplicates, 1);
  assert.equal(r1.new, 30);
  const writesAfterFirst = kv.writes;
  const snap1 = await kv.get<Item[]>("test:snapshot");
  assert.equal(snap1!.length, 30);

  clock += 3600_000;
  const r2 = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r2.status, "unchanged");
  assert.equal(r2.new + r2.updated + r2.removed, 0);
  // Jediný zápis druhého behu = metadata (hset); snapshot/itemhash/verzia sa neprepisujú.
  assert.equal(kv.writes - writesAfterFirst, 1, "rovnaké dáta = žiadny zápis obsahu");
  assert.deepEqual(await kv.get("test:snapshot"), snap1);
  const m = await meta(kv);
  assert.equal(m.unchangedStreak, 1);
  assert.equal(m.lastSuccessItemCount, 30);
}

// ── 2. Zmena: nové / zmenené / odstránené položky sa spočítajú, snapshot sa aktualizuje ──
{
  const kv = createMemoryKv();
  let data = items(25);
  const def = source(async () => ({ items: data }));
  await runFeed(def, { kv, now, sleep: noSleep });
  data = [...items(24).map((i) => (i.id === "3" ? { ...i, title: "zmenené" } : i)), { id: "new-1", title: "nová" }];
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.status, "updated");
  assert.equal(r.new, 1);
  assert.equal(r.updated, 1);
  assert.equal(r.removed, 1);
  assert.equal((await kv.get<Item[]>("test:snapshot"))!.length, 25);
  assert.ok(await kv.get(feedVersionKey("test-feed")), "verzia snapshotu sa zapíše");
}

// ── 3. Feed = 0 položiek → žiadne hromadné mazanie ──
{
  const kv = createMemoryKv();
  let data = items(40);
  const def = source(async () => ({ items: data }));
  await runFeed(def, { kv, now, sleep: noSleep });
  data = [];
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.status, "rejected");
  assert.equal(r.errorKind, "empty");
  assert.equal((await kv.get<Item[]>("test:snapshot"))!.length, 40, "posledné validné dáta zostávajú");
  const m = await meta(kv);
  assert.equal(m.status, "error");
  assert.equal(m.lastSuccessItemCount, 40, "posledný úspech sa neprepíše nulou");
}

// ── 4. Timeout → retry s backoffom, potom cooldown; dáta zostávajú ──
{
  const kv = createMemoryKv();
  let fail = false;
  const def = source(async () => {
    if (fail) { const e = new Error("The operation was aborted due to timeout"); e.name = "TimeoutError"; throw e; }
    return { items: items(30) };
  });
  await runFeed(def, { kv, now, sleep: noSleep });
  fail = true;
  const delays: number[] = [];
  def.calls = 0;
  const r = await runFeed(def, { kv, now, sleep: async (ms) => { delays.push(ms); } });
  assert.equal(r.status, "error");
  assert.equal(r.errorKind, "timeout");
  assert.equal(def.calls, 3, "3 pokusy");
  assert.deepEqual(delays, [1000, 3000], "backoff 1 s → 3 s");
  assert.equal((await kv.get<Item[]>("test:snapshot"))!.length, 30, "timeout nezmaže dáta");
  const m = await meta(kv);
  assert.equal(m.consecutiveErrors, 1);
  assert.ok(Date.parse(m.nextDueAt!) - clock >= 30 * 60_000, "cooldown aspoň 30 min");
  assert.equal(isFeedDue(m, clock), false, "počas cooldownu feed nie je splatný");
  // druhé a tretie zlyhanie → dlhší cooldown
  await runFeed(def, { kv, now, sleep: noSleep });
  await runFeed(def, { kv, now, sleep: noSleep });
  const m3 = await meta(kv);
  assert.equal(m3.consecutiveErrors, 3);
  assert.ok(Date.parse(m3.nextDueAt!) - clock > Date.parse(m.nextDueAt!) - clock, "cooldown rastie");
}

// ── 5. 5xx raz, potom úspech ──
{
  const kv = createMemoryKv();
  const def = source(async (n) => {
    if (n === 1) throw new FeedError("http_5xx", "HTTP 502", { status: 502 });
    return { items: items(10) };
  });
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.status, "updated");
  assert.equal(r.attempts, 2);
}

// ── 6. 4xx (napr. 404) → bez retry; 429 s dlhým Retry-After → bez retry ──
{
  const kv = createMemoryKv();
  const def404 = source(async () => { throw new FeedError("http_4xx", "HTTP 404", { status: 404 }); });
  const r = await runFeed(def404, { kv, now, sleep: noSleep });
  assert.equal(def404.calls, 1);
  assert.equal(r.errorKind, "http_4xx");
  const def429 = source(async () => { throw new FeedError("rate_limited", "HTTP 429", { status: 429, retryAfterMs: 120_000 }); });
  await runFeed(def429, { kv: createMemoryKv(), now, sleep: noSleep });
  assert.equal(def429.calls, 1, "429 s Retry-After 2 min sa v tom istom behu neopakuje");
  const def429short = source(async (n) => { if (n === 1) throw new FeedError("rate_limited", "HTTP 429", { status: 429, retryAfterMs: 2000 }); return { items: items(3) }; });
  const r429 = await runFeed(def429short, { kv: createMemoryKv(), now, sleep: noSleep });
  assert.equal(r429.status, "updated");
}

// ── 7. Auth chyba → obnova tokenu a nový pokus ──
{
  let refreshed = 0;
  const def = source(async (n) => { if (n === 1) throw new FeedError("auth", "HTTP 401", { status: 401 }); return { items: items(5) }; }, {
    onAuthError: async () => { refreshed++; return true; },
  });
  const r = await runFeed(def, { kv: createMemoryKv(), now, sleep: noSleep });
  assert.equal(refreshed, 1);
  assert.equal(r.status, "updated");
}

// ── 8. Podozrivý pokles → prijatý až po DROP_CONFIRMATIONS potvrdeniach ──
{
  const kv = createMemoryKv();
  let data = items(100);
  const def = source(async () => ({ items: data }));
  await runFeed(def, { kv, now, sleep: noSleep });
  data = items(20);
  for (let i = 1; i < DROP_CONFIRMATIONS; i++) {
    const r = await runFeed(def, { kv, now, sleep: noSleep });
    assert.equal(r.status, "rejected", `pokles ${i}. potvrdenie → ešte odmietnutý`);
    assert.equal(r.errorKind, "suspicious_drop");
    assert.equal((await kv.get<Item[]>("test:snapshot"))!.length, 100);
    assert.equal((await meta(kv)).consecutiveErrors, 0, "pokles nie je sieťová chyba");
  }
  const ok = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(ok.status, "updated", "opakovaný rovnaký pokles je realita");
  assert.equal((await kv.get<Item[]>("test:snapshot"))!.length, 20);
  assert.equal((await meta(kv)).pendingDrop, null);
}

// ── 9. Nevalidná schéma (>20 % zlých položiek) → odmietnutý ──
{
  const kv = createMemoryKv();
  const def = source(async () => ({ items: [...items(6), ...items(4, "x").map((i) => ({ ...i, id: `bad${i.id}`, ok: false }))] }));
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.errorKind, "validation");
  assert.equal(await kv.get("test:snapshot"), null);
  // pod prahom sa nevalidné len vyradia
  const def2 = source(async () => ({ items: [...items(19), { id: "bad", title: "", ok: false }] }));
  const r2 = await runFeed(def2, { kv: createMemoryKv(), now, sleep: noSleep });
  assert.equal(r2.status, "updated");
  assert.equal(r2.invalid, 1);
  assert.equal(r2.items, 19);
}

// ── 10. 304 Not Modified → nič sa neparsuje ani nezapisuje ──
{
  const kv = createMemoryKv();
  let seenEtag: string | null = null;
  const def = source(async () => ({ items: items(12), etag: '"v1"' }), {});
  await runFeed(def, { kv, now, sleep: noSleep });
  const def304 = source(async () => ({ notModified: true }), {
    fetch: async function (this: unknown, ctx) { seenEtag = ctx.etag; return { notModified: true }; },
  });
  const before = kv.writes;
  const r = await runFeed(def304, { kv, now, sleep: noSleep });
  assert.equal(seenEtag, '"v1"', "ETag sa pošle v ďalšom requeste");
  assert.equal(r.status, "not_modified");
  assert.equal(kv.writes - before, 1, "iba metadata");
  assert.equal(r.items, 12);
}

// ── 11. Adaptívny interval: nezmenený feed sa kontroluje menej často, zmena vráti základ ──
{
  const kv = createMemoryKv();
  let data = items(10);
  const def = source(async () => ({ items: data }));
  await runFeed(def, { kv, now, sleep: noSleep });
  for (let i = 0; i < 4; i++) await runFeed(def, { kv, now, sleep: noSleep });
  const slow = await meta(kv);
  assert.ok(slow.intervalMin > 180 && slow.intervalMin <= 720, `interval narástol (${slow.intervalMin})`);
  data = items(11);
  await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal((await meta(kv)).intervalMin, 180);
}

// ── 12. Dry-run → žiadne zápisy ──
{
  const kv = createMemoryKv();
  const def = source(async () => ({ items: items(8) }));
  const r = await runFeed(def, { kv, now, sleep: noSleep, dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(r.new, 8);
  assert.equal(kv.writes, 0);
  assert.deepEqual(kv.dump(), {});
}

// ── 13. Nenakonfigurovaný zdroj → disabled, bez volania siete ──
{
  const kv = createMemoryKv();
  const def = source(async () => ({ items: items(3) }), { configured: () => false });
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.status, "skipped");
  assert.equal(def.calls, 0);
  assert.equal((await meta(kv)).status, "disabled");
}

// ── 14. Verziované čítanie: celý snapshot sa znova stiahne len pri zmene verzie ──
{
  const kv = createMemoryKv();
  let dataGets = 0;
  const counting = { ...kv, get: async <T,>(key: string) => { if (key === "snap:x") dataGets++; return kv.get<T>(key); } };
  await kv.set("snap:x", [1, 2, 3]);
  await kv.set("ver:x", "a");
  let t = 0;
  clearSnapshotMemo();
  const read = () => readVersionedSnapshot<number[]>("snap:x", "ver:x", { kv: counting, now: () => t, memoMs: 60_000 });
  assert.deepEqual(await read(), [1, 2, 3]);
  t += 30_000; await read();
  t += 60_000; await read(); // memo vypršalo, verzia rovnaká → bez sťahovania dát
  assert.equal(dataGets, 1);
  await kv.set("snap:x", [9]);
  await kv.set("ver:x", "b");
  t += 61_000;
  assert.deepEqual(await read(), [9]);
  assert.equal(dataGets, 2);
}

// ── 14b. Fingerprint: volatilné, ale ekvivalentné pole (CJ rotuje doménu linku) nie je zmena ──
{
  const kv = createMemoryKv();
  let host = "dpbolvw.net";
  const def = source(async () => ({ items: items(12).map((i) => ({ ...i, title: `https://www.${host}/click-1-${i.id}` })) }), {
    fingerprint: (i: Item) => ({ ...i, title: i.title.replace(/^https?:\/\/[^/]+/, "cj:") }),
  });
  await runFeed(def, { kv, now, sleep: noSleep });
  host = "kqzyfj.com";
  const before = kv.writes;
  const r = await runFeed(def, { kv, now, sleep: noSleep });
  assert.equal(r.status, "unchanged");
  assert.equal(r.updated, 0);
  assert.equal(kv.writes - before, 1, "iba metadata");
}

// ── 15. Klasifikácia chýb a cooldown ──
{
  const t = new Error("x"); t.name = "TimeoutError";
  assert.equal(classifyError(t).kind, "timeout");
  assert.equal(classifyError(new SyntaxError("Unexpected token < in JSON")).kind, "parse");
  assert.equal(isRetryable(new FeedError("http_5xx", "")), true);
  assert.equal(isRetryable(new FeedError("parse", "")), false);
  assert.equal(isRetryable(new FeedError("validation", "")), false);
  assert.equal(cooldownMinutes(1, "auth", 180), 720, "auth chyba = dlhý cooldown");
  assert.ok(cooldownMinutes(5, "timeout", 180) <= 720, "cooldown je zhora ohraničený");
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new FeedError("network", "down"); }, { sleep: noSleep, attempts: 3 }));
  assert.equal(calls, 3, "žiadne nekonečné retry");
}

console.log("Feed engine tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
