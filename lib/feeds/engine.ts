/**
 * Jednotný feed engine nad existujúcimi affiliate zdrojmi (Dognet, eHub, CJ, Affial).
 *
 * Lifecycle každého zdroja:
 *   DISCOVER  zoznam zdrojov = lib/feeds/sources.ts (konfigurované → aktívne)
 *   FETCH     withRetry (timeout/5xx/429 backoff, auth refresh), ETag/Last-Modified
 *   VALIDATE  schéma položiek; >20 % nevalidných = zlyhaný feed
 *   PARSE/NORMALIZE  v definícii zdroja (existujúce parsery sietí)
 *   DEDUPLICATE  podľa stabilného itemKey (external ID siete)
 *   UPSERT    snapshot sa zapíše IBA pri zmene checksumu (inak len predĺženie TTL)
 *   EXPIRE    položky, ktoré z validného feedu zmizli, vypadnú zo snapshotu;
 *             SEO/článkový lifecycle ich rieši s grace periodou (lib/sale-articles.ts)
 *   REPORT    metadata v `feeds:meta` + job log
 *
 * FAILURE SAFETY: pri chybe, prázdnom feede alebo podozrivom poklese sa snapshot
 * NIKDY neprepíše — ostáva posledná validná verzia (last-good, TTL 7 dní).
 * Idempotencia: rovnaké dáta 2× = rovnaký checksum = žiadny zápis.
 */
import { fnv1a, redisKv, stableStringify, type Kv } from "@/lib/kv";
import { safeErrorMessage } from "@/lib/jobs/log";
import { classifyError, cooldownMinutes, FeedError, withRetry, type FeedErrorKind } from "./fetch";

export type FeedTier = "high" | "medium" | "low";
export type FeedFormat = "json-api" | "xml";
/** Čo zmena feedu ovplyvňuje — riadi následné kroky ticku (články, zoznam obchodov…). */
export type FeedEffect = "coupons" | "actions" | "shops" | "images";

export interface FetchContext {
  etag: string | null;
  lastModified: string | null;
  deadline: number;
}

export interface FetchResult<T> {
  notModified?: boolean;
  items?: T[];
  etag?: string | null;
  lastModified?: string | null;
}

export interface FeedSourceDef<T = unknown> {
  id: string;
  provider: string;
  label: string;
  /** Verejne zobraziteľná URL/endpoint (bez kľúčov). */
  url: string;
  format: FeedFormat;
  tier: FeedTier;
  baseIntervalMin: number;
  maxIntervalMin: number;
  snapshotKey: string;
  snapshotTtlSec?: number;
  affects: FeedEffect[];
  configured(): boolean;
  fetch(ctx: FetchContext): Promise<FetchResult<T>>;
  itemKey(item: T): string;
  isValidItem?(item: T): boolean;
  onAuthError?(): Promise<boolean>;
  /** Od akej veľkosti posledného úspechu sa uplatní ochrana proti poklesu. */
  minItemsForDropCheck?: number;
}

export type FeedStatus = "never" | "ok" | "warning" | "error" | "disabled";

export interface FeedMeta {
  id: string;
  provider: string;
  label: string;
  url: string;
  format: FeedFormat;
  tier: FeedTier;
  status: FeedStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangeAt: string | null;
  lastSuccessItemCount: number;
  lastNewCount: number;
  lastUpdatedCount: number;
  lastRemovedCount: number;
  lastInvalidCount: number;
  lastDuplicateCount: number;
  lastError: string | null;
  lastErrorKind: FeedErrorKind | null;
  lastErrorAt: string | null;
  consecutiveErrors: number;
  durationMs: number;
  attempts: number;
  checksum: string | null;
  etag: string | null;
  lastModified: string | null;
  intervalMin: number;
  unchangedStreak: number;
  nextDueAt: string | null;
  pendingDrop: { count: number; seen: number; firstAt: string } | null;
  totalRuns: number;
  totalChanges: number;
}

export type FeedRunStatus = "updated" | "unchanged" | "not_modified" | "rejected" | "error" | "skipped";

export interface FeedRunReport {
  id: string;
  status: FeedRunStatus;
  changed: boolean;
  items: number;
  new: number;
  updated: number;
  removed: number;
  invalid: number;
  duplicates: number;
  attempts: number;
  durationMs: number;
  error?: string;
  errorKind?: FeedErrorKind;
  dryRun?: boolean;
}

export const FEED_META_KEY = "feeds:meta";
export const FEED_SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600;
/** Kým sa pokles prijme ako reálny, musí sa zopakovať toľkokrát po sebe. */
export const DROP_CONFIRMATIONS = 3;
/** Pokles pod túto časť posledného úspechu je podozrivý. */
export const DROP_RATIO = 0.5;
const DROP_TOLERANCE = 0.15;
const INVALID_RATIO_MAX = 0.2;
/** Tick beží nepresne (Vercel Hobby ±59 min) — feed je splatný s touto rezervou. */
export const DUE_SLACK_MIN = 20;

export const itemHashKey = (id: string) => `feeds:itemhash:${id}`;
export const feedVersionKey = (id: string) => `feeds:ver:${id}`;

export function initialMeta<T>(def: FeedSourceDef<T>): FeedMeta {
  return {
    id: def.id,
    provider: def.provider,
    label: def.label,
    url: def.url,
    format: def.format,
    tier: def.tier,
    status: "never",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastChangeAt: null,
    lastSuccessItemCount: 0,
    lastNewCount: 0,
    lastUpdatedCount: 0,
    lastRemovedCount: 0,
    lastInvalidCount: 0,
    lastDuplicateCount: 0,
    lastError: null,
    lastErrorKind: null,
    lastErrorAt: null,
    consecutiveErrors: 0,
    durationMs: 0,
    attempts: 0,
    checksum: null,
    etag: null,
    lastModified: null,
    intervalMin: def.baseIntervalMin,
    unchangedStreak: 0,
    nextDueAt: null,
    pendingDrop: null,
    totalRuns: 0,
    totalChanges: 0,
  };
}

export async function loadAllFeedMeta(kv: Kv = redisKv): Promise<Record<string, FeedMeta>> {
  try {
    return (await kv.hgetall<FeedMeta>(FEED_META_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function isFeedDue(meta: FeedMeta | undefined, now: number): boolean {
  if (!meta?.nextDueAt) return true;
  const due = Date.parse(meta.nextDueAt);
  return !Number.isFinite(due) || now >= due - DUE_SLACK_MIN * 60_000;
}

/** Adaptívny interval: nezmenený feed sa postupne kontroluje menej často, zmena vráti základ. */
export function nextInterval(def: Pick<FeedSourceDef, "baseIntervalMin" | "maxIntervalMin">, current: number, changed: boolean, unchangedStreak: number): number {
  if (changed) return def.baseIntervalMin;
  if (unchangedStreak >= 3) return Math.min(def.maxIntervalMin, Math.round(Math.max(current, def.baseIntervalMin) * 1.5));
  return Math.max(current, def.baseIntervalMin);
}

export function checksumOf(hashes: Record<string, string>): string {
  return fnv1a(Object.keys(hashes).sort().map((k) => `${k}=${hashes[k]}`).join("\n"));
}

export interface RunFeedOptions {
  kv?: Kv;
  now?: () => number;
  dryRun?: boolean;
  /** Absolútny deadline (ms) — retry sa po ňom nespustí. */
  deadline?: number;
  sleep?: (ms: number) => Promise<void>;
  meta?: FeedMeta;
}

/**
 * Spustí jeden zdroj celým lifecyclom. Nikdy nevyhodí — výsledok je vždy report
 * a (mimo dry-run) aktualizované metadata.
 */
export async function runFeed<T>(def: FeedSourceDef<T>, opts: RunFeedOptions = {}): Promise<FeedRunReport> {
  const kv = opts.kv ?? redisKv;
  const now = opts.now ?? Date.now;
  const t0 = now();
  const dryRun = Boolean(opts.dryRun);
  const meta: FeedMeta = { ...initialMeta(def), ...(opts.meta ?? (await kv.hget<FeedMeta>(FEED_META_KEY, def.id).catch(() => null)) ?? {}) };
  const ttl = def.snapshotTtlSec ?? FEED_SNAPSHOT_TTL_SECONDS;
  const report: FeedRunReport = { id: def.id, status: "skipped", changed: false, items: 0, new: 0, updated: 0, removed: 0, invalid: 0, duplicates: 0, attempts: 0, durationMs: 0, ...(dryRun ? { dryRun } : {}) };
  const nowIso = () => new Date(now()).toISOString();

  const persist = async () => {
    report.durationMs = now() - t0;
    meta.durationMs = report.durationMs;
    if (!dryRun) await kv.hset(FEED_META_KEY, { [def.id]: meta }).catch(() => {});
  };

  if (!def.configured()) {
    meta.status = "disabled";
    meta.lastError = "Chýbajú prístupové údaje (env).";
    meta.lastErrorKind = "config";
    await persist();
    return report;
  }

  meta.lastAttemptAt = nowIso();
  meta.totalRuns += 1;

  try {
    const { value: res, attempts } = await withRetry(
      () => def.fetch({ etag: meta.etag, lastModified: meta.lastModified, deadline: opts.deadline ?? t0 + 120_000 }),
      { deadline: opts.deadline, sleep: opts.sleep, now, onAuthError: def.onAuthError },
    );
    report.attempts = attempts;
    meta.attempts = attempts;

    // ── 304 Not Modified: nič nesťahujeme, nič neparsujeme, nič nezapisujeme ──
    if (res.notModified && meta.checksum) {
      if (!dryRun) {
        await kv.expire(def.snapshotKey, ttl).catch(() => {});
        await kv.expire(feedVersionKey(def.id), ttl).catch(() => {});
      }
      report.status = "not_modified";
      report.items = meta.lastSuccessItemCount;
      succeed(meta, def, false, now);
      await persist();
      return report;
    }

    const raw = res.items ?? [];

    // ── VALIDATE ──
    const valid = def.isValidItem ? raw.filter((item) => safeValid(def, item)) : raw;
    report.invalid = raw.length - valid.length;
    if (raw.length > 0 && report.invalid / raw.length > INVALID_RATIO_MAX) {
      throw new FeedError("validation", `${report.invalid}/${raw.length} položiek nemá platnú schému`);
    }

    // ── DEDUPLICATE (stabilný external ID) ──
    const byKey = new Map<string, T>();
    for (const item of valid) {
      const key = def.itemKey(item);
      if (key && !byKey.has(key)) byKey.set(key, item);
    }
    report.duplicates = valid.length - byKey.size;
    const items = [...byKey.values()];
    report.items = items.length;

    // ── PROTECTION: prázdny feed nie je "všetko skončilo" ──
    const prevCount = meta.lastSuccessItemCount;
    if (items.length === 0 && prevCount > 0) {
      throw new FeedError("empty", `Feed vrátil 0 položiek (posledný úspech ${prevCount}) — ponechávam posledné validné dáta`);
    }

    // ── PROTECTION: podozrivý pokles sa prijme až po DROP_CONFIRMATIONS potvrdeniach ──
    const minForDrop = def.minItemsForDropCheck ?? 20;
    if (prevCount >= minForDrop && items.length < prevCount * DROP_RATIO) {
      const pd = meta.pendingDrop;
      const same = pd && Math.abs(items.length - pd.count) <= Math.max(2, pd.count * DROP_TOLERANCE);
      const next = same ? { ...pd!, count: items.length, seen: pd!.seen + 1 } : { count: items.length, seen: 1, firstAt: nowIso() };
      meta.pendingDrop = next;
      if (next.seen < DROP_CONFIRMATIONS) {
        throw new FeedError("suspicious_drop", `Pokles ${prevCount} → ${items.length} (${next.seen}/${DROP_CONFIRMATIONS} potvrdení) — ponechávam posledné validné dáta`);
      }
    }
    meta.pendingDrop = null;

    // ── DIFF + UPSERT (zápis len pri zmene) ──
    const hashes: Record<string, string> = {};
    for (const item of items) hashes[def.itemKey(item)] = fnv1a(stableStringify(item));
    const checksum = checksumOf(hashes);
    const prevHashes = (await kv.get<Record<string, string>>(itemHashKey(def.id)).catch(() => null)) ?? {};
    for (const [k, h] of Object.entries(hashes)) {
      if (!(k in prevHashes)) report.new++;
      else if (prevHashes[k] !== h) report.updated++;
    }
    for (const k of Object.keys(prevHashes)) if (!(k in hashes)) report.removed++;

    const changed = checksum !== meta.checksum;
    report.changed = changed;
    report.status = changed ? "updated" : "unchanged";

    if (!dryRun && items.length > 0) {
      if (changed) {
        await kv.set(def.snapshotKey, items, { ex: ttl });
        await kv.set(itemHashKey(def.id), hashes, { ex: ttl * 2 });
        await kv.set(feedVersionKey(def.id), checksum, { ex: ttl });
      } else {
        // Rovnaké dáta → žiadny zápis obsahu, len predĺženie platnosti last-good snapshotu.
        await kv.expire(def.snapshotKey, ttl).catch(() => {});
        await kv.expire(itemHashKey(def.id), ttl * 2).catch(() => {});
        await kv.expire(feedVersionKey(def.id), ttl).catch(() => {});
      }
    }

    meta.checksum = items.length > 0 ? checksum : meta.checksum;
    meta.etag = res.etag ?? null;
    meta.lastModified = res.lastModified ?? null;
    meta.lastSuccessItemCount = items.length;
    meta.lastNewCount = report.new;
    meta.lastUpdatedCount = report.updated;
    meta.lastRemovedCount = report.removed;
    meta.lastInvalidCount = report.invalid;
    meta.lastDuplicateCount = report.duplicates;
    if (changed) {
      meta.lastChangeAt = nowIso();
      meta.totalChanges += 1;
    }
    succeed(meta, def, changed, now);
    if (items.length === 0) {
      meta.status = "warning";
      meta.lastError = "Zdroj zatiaľ nevrátil žiadne položky.";
    }
  } catch (e) {
    const err = classifyError(e);
    report.error = safeErrorMessage(err);
    report.errorKind = err.kind;
    report.attempts = (err as FeedError & { attempts?: number }).attempts ?? report.attempts;
    meta.lastError = report.error;
    meta.lastErrorKind = err.kind;
    meta.lastErrorAt = nowIso();
    if (err.kind === "suspicious_drop") {
      // Nie je to chyba siete — krátko overíme znova, či pokles pretrvá.
      report.status = "rejected";
      meta.status = "warning";
      meta.nextDueAt = new Date(now() + Math.min(def.baseIntervalMin, 180) * 60_000).toISOString();
    } else {
      report.status = err.kind === "empty" || err.kind === "validation" ? "rejected" : "error";
      meta.status = "error";
      meta.consecutiveErrors += 1;
      meta.nextDueAt = new Date(now() + cooldownMinutes(meta.consecutiveErrors, err.kind, def.baseIntervalMin) * 60_000).toISOString();
    }
  }

  await persist();
  return report;
}

function safeValid<T>(def: FeedSourceDef<T>, item: T): boolean {
  try {
    return Boolean(def.isValidItem!(item));
  } catch {
    return false;
  }
}

function succeed<T>(meta: FeedMeta, def: FeedSourceDef<T>, changed: boolean, now: () => number) {
  meta.status = "ok";
  meta.lastSuccessAt = new Date(now()).toISOString();
  meta.lastError = null;
  meta.lastErrorKind = null;
  meta.consecutiveErrors = 0;
  meta.unchangedStreak = changed ? 0 : meta.unchangedStreak + 1;
  meta.intervalMin = nextInterval(def, meta.intervalMin, changed, meta.unchangedStreak);
  meta.nextDueAt = new Date(now() + meta.intervalMin * 60_000).toISOString();
}

// ─── Čítanie snapshotov s lacnou kontrolou verzie ────────────────────────────

const memos = new Map<string, { at: number; ver: string | null; data: Promise<unknown> }>();

/**
 * Prečíta snapshot s in-process memo. Po uplynutí memo okna najprv overí malý
 * kľúč verzie (checksum) — celý (stovky KB) snapshot sa znova stiahne len keď
 * sa feed naozaj zmenil. Šetrí Redis bandwidth na každej serverless inštancii.
 */
export async function readVersionedSnapshot<T>(
  dataKey: string,
  versionKey: string,
  opts: { memoMs?: number; kv?: Kv; now?: () => number } = {},
): Promise<T | null> {
  const kv = opts.kv ?? redisKv;
  const now = (opts.now ?? Date.now)();
  const memoMs = opts.memoMs ?? 60_000;
  const m = memos.get(dataKey);
  if (m && now - m.at < memoMs) return m.data as Promise<T | null>;
  if (m) {
    const ver = await kv.get<string>(versionKey).catch(() => null);
    if (ver && ver === m.ver) {
      m.at = now;
      return m.data as Promise<T | null>;
    }
  }
  const data = (async () => {
    const [value, ver] = await Promise.all([kv.get<T>(dataKey), kv.get<string>(versionKey).catch(() => null)]);
    const entry = memos.get(dataKey);
    if (entry) entry.ver = ver;
    return value;
  })();
  memos.set(dataKey, { at: now, ver: null, data });
  data.then(
    (v) => { if (v == null || (Array.isArray(v) && v.length === 0)) memos.delete(dataKey); },
    () => memos.delete(dataKey),
  );
  return data;
}

/** Pre testy a po zápise v rovnakej inštancii. */
export function clearSnapshotMemo(dataKey?: string) {
  if (dataKey) memos.delete(dataKey);
  else memos.clear();
}
