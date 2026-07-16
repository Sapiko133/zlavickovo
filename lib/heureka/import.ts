import { getDb } from "@/lib/db";
import { parseHeurekaXmlDetailed } from "./parser";
import { HEUREKA_FEEDS } from "./feeds";
import {
  HEUREKA_IMPORT_BATCH_SIZE,
  HEUREKA_IMPORT_LOCK_TTL_MS,
  HEUREKA_IMPORT_MIN_REMAINING_MS,
  HEUREKA_IMPORT_PARALLELISM,
  HEUREKA_IMPORT_REQUEST_BUDGET_MS,
  HEUREKA_AUDIT_FEED_TIMEOUT_MS,
  HEUREKA_AUDIT_MAX_ITEMS,
  HEUREKA_AUDIT_REQUEST_BUDGET_MS,
  HEUREKA_FULL_FEED_TIMEOUT_MS,
  HEUREKA_MAX_BYTES,
  HEUREKA_RETRY_FEED_TIMEOUT_MS,
} from "./config";
import type {
  HkFeedDef,
  HkFeedErrorType,
  HkImportMode,
  HkImportRunFeedStatus,
  HkImportRunStatus,
} from "./types";
import { parsePriceValue, resolveProductCurrency, type SupportedCurrency } from "@/lib/price";

const LOCK_NAME = "heureka_import";
const DB_BATCH_SIZE = 200;

// Retry run má vlastný type: resume dotaz bežného importu filtruje
// type = 'heureka', takže denný cron nikdy neadoptuje rozbehnutý retry run
// (a naopak). Stĺpec type nemá CHECK constraint, na rozdiel od mode.
const RETRY_RUN_TYPE = "heureka_retry";

type SqlClient = ReturnType<typeof getDb>;

export interface HkFeedImportRow {
  id: string;
  url: string;
  domain: string;
  category: string;
  affiliate_url: string | null;
  currency_code: SupportedCurrency | null;
  enabled: boolean;
}

interface HkImportRunRow {
  id: string;
  mode: HkImportMode;
  status: HkImportRunStatus;
  total_feeds: number;
  processed_feeds: number;
  successful_feeds: number;
  failed_feeds: number;
  cursor_feed_id: string | null;
  error_summary: string | null;
}

interface HkImportRunFeedRow {
  feed_id: string;
  status: HkImportRunFeedStatus;
}

interface FetchXmlResult {
  xml: string;
  truncated: boolean;
  bytesDownloaded: number;
}

export interface HeurekaImportModeConfig {
  maxItems: number;
  feedTimeoutMs: number;
  requestBudgetMs: number;
  // Nový feed sa nezačne, ak v request budgete ostáva menej než táto rezerva.
  // Retry run ju zvyšuje na feedTimeoutMs + rezerva, aby sa dlhý feed nezačal
  // tesne pred koncom budgetu a nezabil ho Vercel maxDuration.
  minRemainingMs: number;
}

export interface ImportHeurekaBatchOptions {
  mode?: HkImportMode;
  batchSize?: number;
  parallelism?: number;
  // Len pre mode=audit: nepokračovať v aktívnom (running/partial) rune, ale
  // založiť úplne nový run s nulovými počítadlami a bez checkpointu. Starý run
  // ostáva v DB nedotknutý. Full režim hodnotu ignoruje — jeho resume logika
  // sa nesmie meniť.
  freshRun?: boolean;
  // Cielený retry: importovať len tieto feed ID (povolené len pre mode=full).
  // ID musia byť v HEUREKA_FEEDS whiteliste, inak importHeurekaBatch odmietne
  // celý request ešte pred získaním locku. Vytvorí/obnoví samostatný retry run
  // (type = 'heureka_retry'), bežné full runy sa nedotknú.
  feedIds?: string[];
  // Test-only: injektovaný SQL klient; produkčná cesta používa getDb().
  sqlClient?: SqlClient;
}

export interface ImportHeurekaBatchFeedResult {
  feedId: string;
  domain: string;
  status: HkImportRunFeedStatus;
  productCount: number;
  durationMs: number;
  errorType?: HkFeedErrorType | null;
  errorMessage?: string;
  // Audit polia — nastavené len pri mode=audit
  sampled?: boolean;
  sampleLimit?: number;
  sampleProductCount?: number;
  // Celkový počet produktov feedu; null = neznámy (feed má viac položiek než vzorka)
  totalProductCount?: number | null;
  feedHasMoreItems?: boolean;
}

export interface ImportHeurekaBatchResult {
  ok: boolean;
  runId: string | null;
  status: HkImportRunStatus | "locked";
  mode: HkImportMode;
  checkpoint: string | null;
  batchSize: number;
  parallelism: number;
  processedInBatch: number;
  results: ImportHeurekaBatchFeedResult[];
  needsNextRequest: boolean;
  lock: {
    name: typeof LOCK_NAME;
    acquired: boolean;
    ttlMs: number;
    owner: string;
    expiresAt?: string;
  };
  counts?: {
    totalFeeds: number;
    processedFeeds: number;
    successfulFeeds: number;
    failedFeeds: number;
  };
  // Nastavené len pri cielenom retry (options.feedIds)
  retry?: boolean;
  retryFeedIds?: string[];
  error?: string;
}

function nowIsoPlus(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

export function getImportModeConfig(mode: HkImportMode, retryRun = false): HeurekaImportModeConfig {
  if (mode === "audit") {
    return {
      maxItems: HEUREKA_AUDIT_MAX_ITEMS,
      feedTimeoutMs: HEUREKA_AUDIT_FEED_TIMEOUT_MS,
      requestBudgetMs: HEUREKA_AUDIT_REQUEST_BUDGET_MS,
      minRemainingMs: HEUREKA_IMPORT_MIN_REMAINING_MS,
    };
  }

  if (retryRun) {
    return {
      maxItems: Number.POSITIVE_INFINITY,
      feedTimeoutMs: HEUREKA_RETRY_FEED_TIMEOUT_MS,
      requestBudgetMs: HEUREKA_IMPORT_REQUEST_BUDGET_MS,
      minRemainingMs: Math.max(
        HEUREKA_IMPORT_MIN_REMAINING_MS,
        HEUREKA_RETRY_FEED_TIMEOUT_MS + 30 * 1000
      ),
    };
  }

  return {
    maxItems: Number.POSITIVE_INFINITY,
    feedTimeoutMs: HEUREKA_FULL_FEED_TIMEOUT_MS,
    requestBudgetMs: HEUREKA_IMPORT_REQUEST_BUDGET_MS,
    minRemainingMs: HEUREKA_IMPORT_MIN_REMAINING_MS,
  };
}

function staticFeedById(): Map<string, HkFeedDef> {
  return new Map(HEUREKA_FEEDS.map((feed) => [feed.id, feed]));
}

/**
 * Whitelist validácia feed ID pre cielený retry: dedupe, trim, kontrola proti
 * HEUREKA_FEEDS. Neznáme ID sa vracajú zvlášť — volajúci ich musí odmietnuť.
 */
export function validateRetryFeedIds(requested: string[]): { valid: string[]; unknown: string[] } {
  const known = staticFeedById();
  const valid: string[] = [];
  const unknown: string[] = [];

  for (const raw of requested) {
    const id = raw.trim();
    if (!id) continue;
    if (!known.has(id)) {
      if (!unknown.includes(id)) unknown.push(id);
    } else if (!valid.includes(id)) {
      valid.push(id);
    }
  }

  valid.sort();
  return { valid, unknown };
}

function deaccent(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isExcluded(name: string, exclude?: string[]): boolean {
  if (!exclude?.length) return false;
  const normalized = deaccent(name);
  return exclude.some((term) => normalized.includes(deaccent(term)));
}

async function syncStaticHeurekaFeeds(sql: SqlClient): Promise<number> {
  for (const feed of HEUREKA_FEEDS) {
    await sql`
      INSERT INTO hk_feeds (id, url, domain, category, affiliate_url, currency_code, enabled)
      VALUES (${feed.id}, ${feed.url}, ${feed.domain}, ${feed.category}, ${feed.affiliateUrl}, ${feed.currencyCode}, true)
      ON CONFLICT (id) DO UPDATE SET
        url           = EXCLUDED.url,
        domain        = EXCLUDED.domain,
        category      = EXCLUDED.category,
        affiliate_url = EXCLUDED.affiliate_url,
        currency_code = EXCLUDED.currency_code
    `;
  }

  return HEUREKA_FEEDS.length;
}

async function acquireImportLock(
  sql: SqlClient,
  owner: string
): Promise<{ acquired: boolean; expiresAt?: string }> {
  const expiresAt = nowIsoPlus(HEUREKA_IMPORT_LOCK_TTL_MS);
  const rows = (await sql`
    INSERT INTO hk_import_locks (name, owner, locked_at, expires_at)
    VALUES (${LOCK_NAME}, ${owner}, now(), ${expiresAt})
    ON CONFLICT (name) DO UPDATE SET
      owner = EXCLUDED.owner,
      locked_at = EXCLUDED.locked_at,
      expires_at = EXCLUDED.expires_at
    WHERE hk_import_locks.expires_at < now()
    RETURNING expires_at
  `) as { expires_at: string }[];

  if (rows.length === 0) return { acquired: false };
  return { acquired: true, expiresAt: rows[0].expires_at };
}

async function attachRunToLock(sql: SqlClient, owner: string, runId: string): Promise<void> {
  await sql`
    UPDATE hk_import_locks
    SET run_id = ${runId}
    WHERE name = ${LOCK_NAME} AND owner = ${owner}
  `;
}

async function releaseImportLock(sql: SqlClient, owner: string): Promise<void> {
  await sql`DELETE FROM hk_import_locks WHERE name = ${LOCK_NAME} AND owner = ${owner}`;
}

async function getEnabledFeedCount(sql: SqlClient): Promise<number> {
  const rows = (await sql`SELECT COUNT(*)::int AS total FROM hk_feeds WHERE enabled = true`) as { total: number }[];
  return rows[0]?.total ?? 0;
}

async function getOrCreateRun(
  sql: SqlClient,
  mode: HkImportMode,
  freshRun = false
): Promise<HkImportRunRow> {
  // freshRun preskočí resume: starý running/partial run sa nečíta, nemaže ani
  // neupravuje — nový run má novší started_at, takže ďalšie requesty bez
  // freshRun pokračujú už v ňom.
  if (!freshRun) {
    const active = (await sql`
      SELECT id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
      FROM hk_import_runs
      WHERE type = 'heureka' AND status IN ('running', 'partial')
      ORDER BY started_at DESC
      LIMIT 1
    `) as HkImportRunRow[];

    if (active[0]) {
      const run = active[0];
      await sql`
        UPDATE hk_import_runs
        SET status = 'running', updated_at = now()
        WHERE id = ${run.id}
      `;
      return { ...run, status: "running" };
    }
  }

  const id = crypto.randomUUID();
  const totalFeeds = await getEnabledFeedCount(sql);
  const rows = (await sql`
    INSERT INTO hk_import_runs (
      id, type, mode, status, started_at, total_feeds, processed_feeds,
      successful_feeds, failed_feeds, cursor_feed_id
    )
    VALUES (${id}, 'heureka', ${mode}, 'running', now(), ${totalFeeds}, 0, 0, 0, null)
    RETURNING id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
  `) as HkImportRunRow[];

  await sql`
    INSERT INTO hk_import_run_feeds (run_id, feed_id, status)
    SELECT ${id}, id, 'pending'
    FROM hk_feeds
    WHERE enabled = true
    ON CONFLICT (run_id, feed_id) DO NOTHING
  `;

  return rows[0];
}

/**
 * Retry run pre konkrétne feed ID. Nikdy nepokračuje v bežnom full rune
 * (a bežný import zas nevidí retry run — filtruje type = 'heureka').
 * Aktívny retry run sa obnoví len vtedy, keď jeho feed set presne sedí
 * s požadovanými ID; inak sa založí nový run a starý ostane nedotknutý.
 */
async function getOrCreateRetryRun(sql: SqlClient, feedIds: string[]): Promise<HkImportRunRow> {
  const active = (await sql`
    SELECT id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
    FROM hk_import_runs
    WHERE type = ${RETRY_RUN_TYPE} AND status IN ('running', 'partial')
    ORDER BY started_at DESC
    LIMIT 1
  `) as HkImportRunRow[];

  if (active[0]) {
    const runFeeds = (await sql`
      SELECT feed_id FROM hk_import_run_feeds WHERE run_id = ${active[0].id}
    `) as { feed_id: string }[];
    const existing = new Set(runFeeds.map((row) => row.feed_id));
    const sameSet = existing.size === feedIds.length && feedIds.every((id) => existing.has(id));

    if (sameSet) {
      await sql`
        UPDATE hk_import_runs
        SET status = 'running', updated_at = now()
        WHERE id = ${active[0].id}
      `;
      return { ...active[0], status: "running" };
    }
  }

  const id = crypto.randomUUID();
  const totalRows = (await sql`
    SELECT COUNT(*)::int AS total FROM hk_feeds WHERE enabled = true AND id = ANY(${feedIds}::text[])
  `) as { total: number }[];
  const totalFeeds = totalRows[0]?.total ?? 0;

  const rows = (await sql`
    INSERT INTO hk_import_runs (
      id, type, mode, status, started_at, total_feeds, processed_feeds,
      successful_feeds, failed_feeds, cursor_feed_id
    )
    VALUES (${id}, ${RETRY_RUN_TYPE}, 'full', 'running', now(), ${totalFeeds}, 0, 0, 0, null)
    RETURNING id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
  `) as HkImportRunRow[];

  await sql`
    INSERT INTO hk_import_run_feeds (run_id, feed_id, status)
    SELECT ${id}, id, 'pending'
    FROM hk_feeds
    WHERE enabled = true AND id = ANY(${feedIds}::text[])
    ON CONFLICT (run_id, feed_id) DO NOTHING
  `;

  return rows[0];
}

async function getRun(sql: SqlClient, runId: string): Promise<HkImportRunRow> {
  const rows = (await sql`
    SELECT id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
    FROM hk_import_runs
    WHERE id = ${runId}
  `) as HkImportRunRow[];
  return rows[0];
}

async function selectNextFeeds(
  sql: SqlClient,
  runId: string,
  cursorFeedId: string | null,
  limit: number,
  retryFeedIds: string[] | null = null
): Promise<HkFeedImportRow[]> {
  if (retryFeedIds) {
    // Retry run: seedujú a vyberajú sa výhradne požadované feed ID
    await sql`
      INSERT INTO hk_import_run_feeds (run_id, feed_id, status)
      SELECT ${runId}, id, 'pending'
      FROM hk_feeds
      WHERE enabled = true AND id = ANY(${retryFeedIds}::text[])
      ON CONFLICT (run_id, feed_id) DO NOTHING
    `;

    if (cursorFeedId) {
      return (await sql`
        SELECT id, url, domain, category, affiliate_url, currency_code, enabled
        FROM hk_feeds
        WHERE enabled = true AND id = ANY(${retryFeedIds}::text[]) AND id > ${cursorFeedId}
        ORDER BY id ASC
        LIMIT ${limit}
      `) as HkFeedImportRow[];
    }

    return (await sql`
      SELECT id, url, domain, category, affiliate_url, currency_code, enabled
      FROM hk_feeds
      WHERE enabled = true AND id = ANY(${retryFeedIds}::text[])
      ORDER BY id ASC
      LIMIT ${limit}
    `) as HkFeedImportRow[];
  }

  await sql`
    INSERT INTO hk_import_run_feeds (run_id, feed_id, status)
    SELECT ${runId}, id, 'pending'
    FROM hk_feeds
    WHERE enabled = true
    ON CONFLICT (run_id, feed_id) DO NOTHING
  `;

  if (cursorFeedId) {
    return (await sql`
      SELECT id, url, domain, category, affiliate_url, currency_code, enabled
      FROM hk_feeds
      WHERE enabled = true AND id > ${cursorFeedId}
      ORDER BY id ASC
      LIMIT ${limit}
    `) as HkFeedImportRow[];
  }

  return (await sql`
    SELECT id, url, domain, category, affiliate_url, currency_code, enabled
    FROM hk_feeds
    WHERE enabled = true
    ORDER BY id ASC
    LIMIT ${limit}
  `) as HkFeedImportRow[];
}

async function setRunFeedStatus(
  sql: SqlClient,
  runId: string,
  feedId: string,
  status: HkImportRunFeedStatus,
  fields: {
    errorType?: HkFeedErrorType;
    errorMessage?: string;
    productCount?: number;
    durationMs?: number;
    finished?: boolean;
  } = {}
): Promise<void> {
  const dbStatus = toDbRunFeedStatus(status);
  await sql`
    INSERT INTO hk_import_run_feeds (
      run_id, feed_id, status, started_at, finished_at, error_type,
      error_message, product_count, duration_ms, updated_at
    )
    VALUES (
      ${runId}, ${feedId}, ${dbStatus}, now(), ${fields.finished ? new Date().toISOString() : null},
      ${fields.errorType ?? null}, ${fields.errorMessage ?? null},
      ${fields.productCount ?? 0}, ${fields.durationMs ?? 0}, now()
    )
    ON CONFLICT (run_id, feed_id) DO UPDATE SET
      status = EXCLUDED.status,
      started_at = COALESCE(hk_import_run_feeds.started_at, EXCLUDED.started_at),
      finished_at = EXCLUDED.finished_at,
      error_type = EXCLUDED.error_type,
      error_message = EXCLUDED.error_message,
      product_count = EXCLUDED.product_count,
      duration_ms = EXCLUDED.duration_ms,
      updated_at = now()
  `;
}

export function isRunFeedSuccessStatus(status: HkImportRunFeedStatus): boolean {
  return status === "success" || status === "empty" || status === "audit_success";
}

// 'audit_success' nie je v DB CHECK constrainte hk_import_run_feeds_status_check
// (produkčná migrácia 20260710 pozná len pôvodné statusy) — do run tabuľky sa
// perzistuje ako 'success'; že šlo o audit, hovorí hk_import_runs.mode.
function toDbRunFeedStatus(status: HkImportRunFeedStatus): HkImportRunFeedStatus {
  return status === "audit_success" ? "success" : status;
}

async function updateRunAfterFeed(
  sql: SqlClient,
  runId: string,
  feedId: string,
  result: ImportHeurekaBatchFeedResult
): Promise<void> {
  const successIncrement = isRunFeedSuccessStatus(result.status) ? 1 : 0;
  const failedIncrement = successIncrement ? 0 : 1;
  const errorSummary = result.errorMessage ? `${feedId}: ${result.errorMessage}`.slice(0, 1000) : null;

  await sql`
    UPDATE hk_import_runs
    SET
      status = 'partial',
      processed_feeds = processed_feeds + 1,
      successful_feeds = successful_feeds + ${successIncrement},
      failed_feeds = failed_feeds + ${failedIncrement},
      cursor_feed_id = ${feedId},
      error_summary = COALESCE(${errorSummary}, error_summary),
      updated_at = now()
    WHERE id = ${runId}
  `;
}

async function finalizeRunIfDone(
  sql: SqlClient,
  runId: string,
  retryFeedIds: string[] | null = null
): Promise<HkImportRunRow> {
  const pendingRows = retryFeedIds
    ? ((await sql`
        SELECT COUNT(*)::int AS remaining
        FROM hk_feeds
        WHERE enabled = true
          AND id = ANY(${retryFeedIds}::text[])
          AND id > COALESCE((SELECT cursor_feed_id FROM hk_import_runs WHERE id = ${runId}), '')
      `) as { remaining: number }[])
    : ((await sql`
        SELECT COUNT(*)::int AS remaining
        FROM hk_feeds
        WHERE enabled = true
          AND id > COALESCE((SELECT cursor_feed_id FROM hk_import_runs WHERE id = ${runId}), '')
      `) as { remaining: number }[]);

  const remaining = pendingRows[0]?.remaining ?? 0;
  const run = await getRun(sql, runId);
  if (remaining > 0) {
    await sql`UPDATE hk_import_runs SET status = 'partial', updated_at = now() WHERE id = ${runId}`;
    return { ...run, status: "partial" };
  }

  // Žiadne zostávajúce feedy = run je hotový. Musí sa finalizovať ako 'success'
  // (nie 'partial'), inak ho getOrCreateRun znova resumuje — jeho resume dotaz
  // filtruje status IN ('running','partial') a nekontroluje finished_at, takže
  // partial run s checkpointom na poslednom feede by sa denne resumoval donekonečna
  // (processedInBatch=0) a nový import by sa nikdy nezaložil. Zlyhania feedov
  // ostávajú vo failed_feeds a per-feed error riadkoch; na ich zopakovanie slúži
  // samostatný retry run (options.feedIds).
  const rows = (await sql`
    UPDATE hk_import_runs
    SET status = 'success', finished_at = now(), updated_at = now()
    WHERE id = ${runId}
    RETURNING id, mode, status, total_feeds, processed_feeds, successful_feeds, failed_feeds, cursor_feed_id, error_summary
  `) as HkImportRunRow[];
  return rows[0];
}

function nextShopitemEnd(xml: string, from: number): number {
  const upper = xml.indexOf("</SHOPITEM>", from);
  const lower = xml.indexOf("</shopitem>", from);
  const idx = upper === -1 ? lower : lower === -1 ? upper : Math.min(upper, lower);
  return idx === -1 ? -1 : idx + "</SHOPITEM>".length;
}

function closeTruncatedXml(xml: string): string {
  const closers: string[] = [];
  const head = xml.slice(0, 4096);
  for (const match of head.matchAll(/<(rss|RSS|SHOP|shop)(?=[\s>])/g)) {
    closers.unshift(`</${match[1]}>`);
  }
  return xml + closers.join("");
}

async function fetchXml(url: string, modeConfig: HeurekaImportModeConfig): Promise<FetchXmlResult> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(modeConfig.feedTimeoutMs),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) {
    const xml = await res.text();
    return { xml, truncated: false, bytesDownloaded: xml.length };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const maxItems = modeConfig.maxItems;
  let xml = "";
  let items = 0;
  let searchFrom = 0;
  let bytesDownloaded = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        xml += decoder.decode();
        return { xml, truncated: false, bytesDownloaded };
      }

      bytesDownloaded += value.byteLength;
      xml += decoder.decode(value, { stream: true });

      let end: number;
      while (items < maxItems && (end = nextShopitemEnd(xml, searchFrom)) !== -1) {
        items++;
        searchFrom = end;
      }

      if (items >= maxItems) {
        return {
          xml: closeTruncatedXml(xml.slice(0, searchFrom)),
          truncated: true,
          bytesDownloaded,
        };
      }

      if (xml.length >= HEUREKA_MAX_BYTES) {
        return {
          xml: searchFrom > 0 ? closeTruncatedXml(xml.slice(0, searchFrom)) : xml,
          truncated: true,
          bytesDownloaded,
        };
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export function classifyFeedError(message: string): HkFeedErrorType {
  if (/timeout|aborted|The operation was aborted/i.test(message)) return "timeout";
  if (/^HTTP\s+\d/i.test(message) || /HTTP\s+\d{3}/i.test(message)) return "http_error";
  if (/unsupported/i.test(message)) return "unsupported_format";
  if (/empty|žiadne produkty|ziadne produkty/i.test(message)) return "empty_feed";
  if (/size|limit|truncated/i.test(message)) return "size_limit";
  if (/database|db|sql|constraint|duplicate/i.test(message)) return "db_error";
  if (/parse|xml|unexpected|malformed|invalid/i.test(message)) return "parse_error";
  return "unknown_error";
}

async function upsertProducts(
  sql: SqlClient,
  feed: HkFeedImportRow,
  products: ReturnType<typeof parseHeurekaXmlDetailed>["products"]
): Promise<number> {
  const unique = Array.from(new Map(products.map((product) => [product.url, product])).values());

  for (let i = 0; i < unique.length; i += DB_BATCH_SIZE) {
    const chunk = unique.slice(i, i + DB_BATCH_SIZE);
    const feedIds = chunk.map(() => feed.id);
    const names = chunk.map((product) => product.name);
    const descriptions = chunk.map((product) => product.description);
    const prices = chunk.map((product) => product.price);
    const currencies = chunk.map((product) =>
      resolveProductCurrency(product.price, product.currencyCode ?? feed.currency_code, feed.domain)
    );
    const urls = chunk.map((product) => product.url);
    const imgs = chunk.map((product) => product.imgUrl);
    const domains = chunk.map(() => feed.domain);
    const cats = chunk.map(() => feed.category);
    const affs = chunk.map(() => feed.affiliate_url);
    const eans = chunk.map((product) => product.ean);
    const itemIds = chunk.map((product) => product.itemId);
    const manufacturers = chunk.map((product) => product.manufacturer);
    const productnos = chunk.map((product) => product.productno);

    await sql`
      INSERT INTO hk_products (feed_id, name, description, price, currency_code, url, img_url, domain, category, affiliate_url, ean, item_id, manufacturer, productno)
      SELECT * FROM UNNEST(
        ${feedIds}::text[], ${names}::text[], ${descriptions}::text[], ${prices}::text[], ${currencies}::text[], ${urls}::text[],
        ${imgs}::text[], ${domains}::text[], ${cats}::text[], ${affs}::text[], ${eans}::text[],
        ${itemIds}::text[], ${manufacturers}::text[], ${productnos}::text[]
      )
      ON CONFLICT (url) DO UPDATE SET
        name          = EXCLUDED.name,
        description   = EXCLUDED.description,
        price         = EXCLUDED.price,
        -- NULL z parsera nesmie prepísať už známu menu existujúceho produktu
        currency_code = COALESCE(EXCLUDED.currency_code, hk_products.currency_code),
        img_url       = EXCLUDED.img_url,
        affiliate_url = EXCLUDED.affiliate_url,
        ean           = EXCLUDED.ean,
        item_id       = EXCLUDED.item_id,
        manufacturer  = EXCLUDED.manufacturer,
        productno     = EXCLUDED.productno,
        updated_at    = now()
    `;
  }

  return unique.length;
}

/**
 * Snapshot cien do product_price_history — LEN PRI ZMENE CENY. Volá sa LEN pre
 * reálne naimportované produkty full/retry behu (nie audit, nie truncated/empty).
 *
 * Pravidlá:
 *  - snapshot sa zapíše iba ak sa cena LÍŠI od posledného zaznamenaného snapshotu
 *    produktu (alebo produkt históriu nemá) — nie denne pre všetkých ~165k
 *    produktov. Šetrí ~95 % zápisov (Neon storage/compute); plný graf vývoja
 *    ceny naprieč trhom aj tak poskytuje Heureka (PROJECT_VISION §17, §33),
 *  - jeden snapshot na produkt (dedup podľa url v rámci feedu),
 *  - cena musí byť parsovateľná a > 0, mena spoľahlivo EUR/CZK — inak sa
 *    snapshot nezapíše (žiadne fiktívne ceny, PROJECT_VISION §17),
 *  - denný dedup rieši DB: UNIQUE (product_url, recorded_day) + ON CONFLICT
 *    DO NOTHING → zachová sa PRVÝ snapshot dňa (ranná cena sa neprepíše).
 */
export async function recordPriceSnapshots(
  sql: SqlClient,
  feed: HkFeedImportRow,
  products: ReturnType<typeof parseHeurekaXmlDetailed>["products"]
): Promise<void> {
  const byUrl = new Map<string, { price: number; currency: SupportedCurrency }>();
  for (const product of products) {
    const amount = parsePriceValue(product.price);
    if (amount === null) continue;
    const currency = resolveProductCurrency(
      product.price,
      product.currencyCode ?? feed.currency_code,
      feed.domain
    );
    if (!currency) continue;
    if (!byUrl.has(product.url)) byUrl.set(product.url, { price: amount, currency });
  }
  if (byUrl.size === 0) return;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const entries = Array.from(byUrl.entries());
  for (let i = 0; i < entries.length; i += DB_BATCH_SIZE) {
    const chunk = entries.slice(i, i + DB_BATCH_SIZE);
    const chunkUrls = chunk.map(([url]) => url);

    // Posledná zaznamenaná cena každého produktu v chunku — snapshot zapíšeme
    // LEN ak sa cena zmenila. Používa index (product_url, recorded_day).
    const lastRows = (await sql`
      SELECT DISTINCT ON (product_url) product_url, price::float8 AS price
      FROM product_price_history
      WHERE product_url = ANY(${chunkUrls}::text[])
      ORDER BY product_url, recorded_day DESC, recorded_at DESC
    `) as { product_url: string; price: number }[];
    const lastByUrl = new Map(lastRows.map((r) => [r.product_url, round2(r.price)]));

    const changed = chunk.filter(([url, v]) => {
      const last = lastByUrl.get(url);
      return last === undefined || last !== round2(v.price);
    });
    if (changed.length === 0) continue;

    const urls = changed.map(([url]) => url);
    const domains = changed.map(() => feed.domain);
    const feedSlugs = changed.map(() => feed.id);
    const prices = changed.map(([, v]) => v.price.toFixed(2));
    const currencies = changed.map(([, v]) => v.currency);
    const sources = changed.map(() => "heureka");

    await sql`
      INSERT INTO product_price_history (product_url, domain, feed_slug, price, currency, source)
      SELECT * FROM UNNEST(
        ${urls}::text[], ${domains}::text[], ${feedSlugs}::text[],
        ${prices}::numeric[], ${currencies}::text[], ${sources}::text[]
      )
      ON CONFLICT (product_url, recorded_day) DO NOTHING
    `;
  }
}

export async function importOneFeed(
  sql: SqlClient,
  runId: string,
  feed: HkFeedImportRow,
  mode: HkImportMode,
  modeConfig: HeurekaImportModeConfig,
  staticFeeds: Map<string, HkFeedDef>
): Promise<ImportHeurekaBatchFeedResult> {
  const startedAt = Date.now();
  const isAudit = mode === "audit";
  await setRunFeedStatus(sql, runId, feed.id, "running");

  try {
    const fetchResult = await fetchXml(feed.url, modeConfig);
    const parseResult = parseHeurekaXmlDetailed(fetchResult.xml, feed.category, {
      maxItems: Number.isFinite(modeConfig.maxItems) ? modeConfig.maxItems : undefined,
      truncated: fetchResult.truncated,
    });

    if (parseResult.status === "parse_error" || parseResult.status === "unsupported_format") {
      // Prefix so statusom parsera — classifyFeedError inak nevie z chybovej hlášky
      // fast-xml-parseru odvodiť parse_error.
      throw new Error(
        parseResult.errorMessage ? `${parseResult.status}: ${parseResult.errorMessage}` : parseResult.status
      );
    }

    const exclude = staticFeeds.get(feed.id)?.exclude;
    const filtered = parseResult.products.filter((product) => !isExcluded(product.name, exclude));

    if (isAudit) {
      // Audit režim: overí zdravie feedu na vzorke. Nezapisuje do hk_products
      // ani do hk_feeds — výsledok ide len do hk_import_run_feeds/hk_import_runs.
      // Dosiahnutie audit limitu nie je chyba.
      const sampleProductCount = filtered.length;
      const durationMs = Date.now() - startedAt;
      const status: HkImportRunFeedStatus = sampleProductCount > 0 ? "audit_success" : "empty";

      await setRunFeedStatus(sql, runId, feed.id, status, {
        productCount: sampleProductCount,
        durationMs,
        finished: true,
      });

      return {
        feedId: feed.id,
        domain: feed.domain,
        status,
        productCount: sampleProductCount,
        durationMs,
        errorType: null,
        sampled: true,
        sampleLimit: modeConfig.maxItems,
        sampleProductCount,
        totalProductCount: parseResult.truncated ? null : sampleProductCount,
        feedHasMoreItems: parseResult.truncated,
      };
    }

    const productCount = parseResult.truncated ? 0 : await upsertProducts(sql, feed, filtered);

    // Cenový snapshot len pre reálne naimportované produkty. Izolovaný try/catch:
    // zlyhanie histórie nesmie zhodiť/označiť zdravý feed ako error (§19/§31).
    if (!parseResult.truncated && productCount > 0) {
      try {
        await recordPriceSnapshots(sql, feed, filtered);
      } catch (snapshotErr) {
        console.error(`[price-history] snapshot feed ${feed.id}:`, snapshotErr);
      }
    }

    const durationMs = Date.now() - startedAt;
    const status: HkImportRunFeedStatus =
      parseResult.truncated ? "truncated" : productCount > 0 ? "success" : "empty";
    const errorType: HkFeedErrorType | undefined = status === "truncated" ? "size_limit" : undefined;
    const errorMessage = status === "truncated" ? "Feed bol orezaný limitom a nebol označený ako úspešný." : undefined;

    await sql`
      UPDATE hk_feeds
      SET
        last_fetched_at = now(),
        last_error = ${errorMessage ?? null},
        error_count = CASE WHEN ${status} IN ('success', 'empty') THEN 0 ELSE error_count + 1 END,
        product_count = ${productCount},
        last_duration_ms = ${durationMs}
      WHERE id = ${feed.id}
    `;

    await setRunFeedStatus(sql, runId, feed.id, status, {
      errorType,
      errorMessage,
      productCount,
      durationMs,
      finished: true,
    });

    return {
      feedId: feed.id,
      domain: feed.domain,
      status,
      productCount,
      durationMs,
      errorType,
      errorMessage,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const errorType = classifyFeedError(errorMessage);

    if (!isAudit) {
      await sql`
        UPDATE hk_feeds
        SET
          last_fetched_at = now(),
          last_error = ${errorMessage},
          error_count = error_count + 1,
          last_duration_ms = ${durationMs}
        WHERE id = ${feed.id}
      `;
    }

    await setRunFeedStatus(sql, runId, feed.id, "error", {
      errorType,
      errorMessage,
      productCount: 0,
      durationMs,
      finished: true,
    });

    return {
      feedId: feed.id,
      domain: feed.domain,
      status: "error",
      productCount: 0,
      durationMs,
      errorType,
      errorMessage,
      ...(isAudit
        ? {
            sampled: true,
            sampleLimit: modeConfig.maxItems,
            sampleProductCount: 0,
            totalProductCount: null,
          }
        : {}),
    };
  }
}

async function hasRemainingFeeds(
  sql: SqlClient,
  runId: string,
  retryFeedIds: string[] | null = null
): Promise<boolean> {
  const rows = retryFeedIds
    ? ((await sql`
        SELECT COUNT(*)::int AS remaining
        FROM hk_feeds
        WHERE enabled = true
          AND id = ANY(${retryFeedIds}::text[])
          AND id > COALESCE((SELECT cursor_feed_id FROM hk_import_runs WHERE id = ${runId}), '')
      `) as { remaining: number }[])
    : ((await sql`
        SELECT COUNT(*)::int AS remaining
        FROM hk_feeds
        WHERE enabled = true
          AND id > COALESCE((SELECT cursor_feed_id FROM hk_import_runs WHERE id = ${runId}), '')
      `) as { remaining: number }[]);
  return (rows[0]?.remaining ?? 0) > 0;
}

export async function importHeurekaBatch(
  options: ImportHeurekaBatchOptions = {}
): Promise<ImportHeurekaBatchResult> {
  const sql = options.sqlClient ?? getDb();
  const owner = crypto.randomUUID();
  const requestedMode = options.mode ?? "full";
  // freshRun smie ovplyvniť iba audit — full import sa nesmie začať odznova.
  const freshRun = requestedMode === "audit" && options.freshRun === true;
  const batchSize = normalizeLimit(options.batchSize, HEUREKA_IMPORT_BATCH_SIZE, 10);
  const parallelism = normalizeLimit(options.parallelism, HEUREKA_IMPORT_PARALLELISM, 3);

  // Cielený retry sa validuje ešte pred získaním locku — neplatný request
  // nesmie prevziať lock ani založiť run.
  let retryFeedIds: string[] | null = null;
  if (options.feedIds && options.feedIds.length > 0) {
    if (requestedMode !== "full") {
      throw new Error("feedIds retry je povolený len pre mode=full");
    }
    const { valid, unknown } = validateRetryFeedIds(options.feedIds);
    if (unknown.length > 0) {
      throw new Error(`Neznáme feed ID (nie sú v HEUREKA_FEEDS): ${unknown.join(", ")}`);
    }
    if (valid.length === 0) {
      throw new Error("feedIds neobsahuje žiadne platné feed ID");
    }
    retryFeedIds = valid;
  }

  const lock = await acquireImportLock(sql, owner);

  if (!lock.acquired) {
    return {
      ok: false,
      runId: null,
      status: "locked",
      mode: requestedMode,
      checkpoint: null,
      batchSize,
      parallelism,
      processedInBatch: 0,
      results: [],
      needsNextRequest: true,
      lock: {
        name: LOCK_NAME,
        acquired: false,
        ttlMs: HEUREKA_IMPORT_LOCK_TTL_MS,
        owner,
      },
      error: "Heureka import už beží.",
    };
  }

  let runId: string | null = null;

  try {
    const startedAt = Date.now();
    await syncStaticHeurekaFeeds(sql);
    const run = retryFeedIds
      ? await getOrCreateRetryRun(sql, retryFeedIds)
      : await getOrCreateRun(sql, requestedMode, freshRun);
    const mode = run.mode;
    const modeConfig = getImportModeConfig(mode, retryFeedIds !== null);
    runId = run.id;
    await attachRunToLock(sql, owner, run.id);

    const staticFeeds = staticFeedById();
    const results: ImportHeurekaBatchFeedResult[] = [];
    let cursor = run.cursor_feed_id;
    let currentRun = run;

    while (results.length < batchSize) {
      const elapsed = Date.now() - startedAt;
      const remaining = modeConfig.requestBudgetMs - elapsed;
      if (remaining < modeConfig.minRemainingMs) break;

      const limit = Math.min(parallelism, batchSize - results.length);
      const feeds = await selectNextFeeds(sql, run.id, cursor, limit, retryFeedIds);
      if (feeds.length === 0) break;

      const settled = await Promise.allSettled(
        feeds.map((feed) => importOneFeed(sql, run.id, feed, mode, modeConfig, staticFeeds))
      );

      for (let i = 0; i < settled.length; i++) {
        const feed = feeds[i];
        const settledResult = settled[i];
        const result =
          settledResult.status === "fulfilled"
            ? settledResult.value
            : {
                feedId: feed.id,
                domain: feed.domain,
                status: "error" as const,
                productCount: 0,
                durationMs: 0,
                errorType: classifyFeedError(String(settledResult.reason)),
                errorMessage: String(settledResult.reason).slice(0, 500),
              };

        await updateRunAfterFeed(sql, run.id, feed.id, result);
        cursor = feed.id;
        results.push(result);
      }

      if (Date.now() - startedAt >= modeConfig.requestBudgetMs) break;
    }

    currentRun = await finalizeRunIfDone(sql, run.id, retryFeedIds);
    const needsNextRequest = await hasRemainingFeeds(sql, run.id, retryFeedIds);

    return {
      ok: true,
      runId: run.id,
      status: currentRun.status,
      mode,
      checkpoint: currentRun.cursor_feed_id,
      batchSize,
      parallelism,
      processedInBatch: results.length,
      results,
      needsNextRequest,
      lock: {
        name: LOCK_NAME,
        acquired: true,
        ttlMs: HEUREKA_IMPORT_LOCK_TTL_MS,
        owner,
        expiresAt: lock.expiresAt,
      },
      counts: {
        totalFeeds: currentRun.total_feeds,
        processedFeeds: currentRun.processed_feeds,
        successfulFeeds: currentRun.successful_feeds,
        failedFeeds: currentRun.failed_feeds,
      },
      ...(retryFeedIds ? { retry: true, retryFeedIds } : {}),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (runId) {
      await sql`
        UPDATE hk_import_runs
        SET status = 'error', finished_at = now(), error_summary = ${error.slice(0, 1000)}, updated_at = now()
        WHERE id = ${runId}
      `;
    }
    throw err;
  } finally {
    await releaseImportLock(sql, owner);
  }
}

export async function getHeurekaImportFeedState(
  runId: string
): Promise<HkImportRunFeedRow[]> {
  const sql = getDb();
  return (await sql`
    SELECT feed_id, status
    FROM hk_import_run_feeds
    WHERE run_id = ${runId}
    ORDER BY feed_id ASC
  `) as HkImportRunFeedRow[];
}
