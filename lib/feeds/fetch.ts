/**
 * Sieťová vrstva feed enginu: klasifikácia chýb, bezpečný retry s backoffom
 * a cooldown plánovanie. Čistý modul (sleep/now injektovateľné pre testy).
 *
 * Pravidlá:
 * - timeout / sieťová chyba / 5xx → retry (max 3 pokusy, 1 s → 3 s → 9 s)
 * - 429 → retry iba ak Retry-After ≤ 10 s, inak okamžite cooldown
 * - 401/403 → auth (bez retry; volajúci môže obnoviť token)
 * - iné 4xx, parse, validation, config → bez retry (opakovanie nepomôže)
 * - po neúspešnom behu feed dostane cooldown podľa počtu po sebe idúcich chýb
 *   (nikdy nekonečné retry, nikdy nepreťaženie providera)
 */

export type FeedErrorKind =
  | "timeout"
  | "network"
  | "http_5xx"
  | "rate_limited"
  | "auth"
  | "http_4xx"
  | "parse"
  | "validation"
  | "empty"
  | "suspicious_drop"
  | "config";

export class FeedError extends Error {
  readonly kind: FeedErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(kind: FeedErrorKind, message: string, opts: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "FeedError";
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

const RETRYABLE: ReadonlySet<FeedErrorKind> = new Set(["timeout", "network", "http_5xx", "rate_limited"]);

export function isRetryable(err: FeedError): boolean {
  if (err.kind === "rate_limited") return (err.retryAfterMs ?? Infinity) <= 10_000;
  return RETRYABLE.has(err.kind);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

/** HTTP odpoveď → FeedError (alebo null pri 2xx/304). */
export function errorFromResponse(res: { status: number; headers: { get(name: string): string | null } }, label: string): FeedError | null {
  const s = res.status;
  if ((s >= 200 && s < 300) || s === 304) return null;
  if (s === 429) {
    return new FeedError("rate_limited", `${label}: HTTP 429`, { status: s, retryAfterMs: parseRetryAfter(res.headers.get("retry-after")) });
  }
  if (s === 401 || s === 403) return new FeedError("auth", `${label}: HTTP ${s}`, { status: s });
  if (s >= 500) return new FeedError("http_5xx", `${label}: HTTP ${s}`, { status: s });
  return new FeedError("http_4xx", `${label}: HTTP ${s}`, { status: s });
}

/** Ľubovoľná výnimka → FeedError s druhom chyby. */
export function classifyError(e: unknown): FeedError {
  if (e instanceof FeedError) return e;
  const err = e as { name?: string; message?: string; cause?: { code?: string } } | null;
  const name = err?.name ?? "";
  const msg = err?.message ?? String(e);
  if (name === "TimeoutError" || name === "AbortError" || /timed? ?out|aborted/i.test(msg)) {
    return new FeedError("timeout", msg);
  }
  if (name === "SyntaxError" || /JSON|XML|parse/i.test(msg)) return new FeedError("parse", msg);
  const code = err?.cause?.code ?? "";
  if (/ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR/i.test(code) || name === "TypeError" && /fetch failed/i.test(msg)) {
    return new FeedError("network", msg);
  }
  return new FeedError("network", msg);
}

/** fetch, ktorý pri ne-2xx/304 vyhodí klasifikovanú FeedError. */
export async function fetchChecked(url: string, init: RequestInit & { timeoutMs?: number }, label: string): Promise<Response> {
  const { timeoutMs = 20_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...rest, signal: rest.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw classifyError(e);
  }
  const err = errorFromResponse(res, label);
  if (err) throw err;
  return res;
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Absolútny čas (ms), po ktorom sa už ďalší pokus nespustí (rozpočet ticku). */
  deadline?: number;
  now?: () => number;
  /** Zavolá sa pred retry po auth chybe (napr. obnova tokenu). Vráti true = skúsiť znova. */
  onAuthError?: () => Promise<boolean>;
}

export interface RetryOutcome<T> {
  value: T;
  attempts: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Spustí fn s retry podľa klasifikácie chyby. Pri vyčerpaní vyhodí poslednú FeedError s .attempts. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<RetryOutcome<T>> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const factor = opts.factor ?? 3;
  const maxDelay = opts.maxDelayMs ?? 10_000;
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? Date.now;
  let authRefreshed = false;
  let last: FeedError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (e) {
      last = classifyError(e);
      const canRefreshAuth = last.kind === "auth" && !authRefreshed && opts.onAuthError;
      if (canRefreshAuth) {
        authRefreshed = true;
        if (await opts.onAuthError!().catch(() => false)) continue;
      }
      if (attempt >= attempts || !isRetryable(last)) break;
      const delay = Math.min(maxDelay, last.kind === "rate_limited" && last.retryAfterMs != null ? last.retryAfterMs : base * factor ** (attempt - 1));
      if (opts.deadline && now() + delay > opts.deadline) break;
      await sleep(delay);
    }
  }
  const err = last ?? new FeedError("network", "Neznáma chyba");
  (err as FeedError & { attempts?: number }).attempts = attempts;
  throw err;
}

/**
 * Cooldown po neúspešnom behu: exponenciálne podľa počtu po sebe idúcich chýb,
 * ale nikdy kratšie než 30 min a nikdy dlhšie než cap (default 12 h).
 * Konfiguračné/auth chyby dostanú rovno dlhší cooldown (opakovanie nepomôže).
 */
export function cooldownMinutes(consecutiveErrors: number, kind: FeedErrorKind, baseIntervalMin: number, capMin = 720): number {
  if (kind === "config" || kind === "auth" || kind === "http_4xx") return capMin;
  const n = Math.max(1, consecutiveErrors);
  const start = Math.min(baseIntervalMin, 60);
  return Math.min(capMin, Math.max(30, start * 2 ** (n - 1)));
}
