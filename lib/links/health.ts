/**
 * Affiliate link health — plánovaná kontrola na pozadí (nikdy pri requeste).
 *
 * BEZPEČNOSŤ MONETIZÁCIE: tracking redirecty sietí (go.dognet.com, CJ, eHub, Affial)
 * sa NEvolajú — automatický klik by sa mohol započítať ako podvodný klik. Kontroluje
 * sa cieľová (destination) URL obchodu, ktorú vieme z tracking linku bezpečne
 * vyčítať; linky bez čitateľného cieľa sa preskočia.
 *
 * Dočasná chyba ponuku nevyradí: status "dead" až po 3 po sebe idúcich zlyhaniach.
 * Výsledky: Redis hash `links:health` (kľúč = normalizovaná cieľová URL).
 */
import { fnv1a, redisKv, type Kv } from "@/lib/kv";
import { destinationOf, normalizeOfferUrl } from "@/lib/offers/url";

export type LinkStatus = "ok" | "redirect" | "warn" | "dead";

export interface LinkHealth {
  url: string;
  status: LinkStatus;
  httpStatus: number | null;
  redirects: number;
  finalUrl: string | null;
  error: string | null;
  consecutiveFailures: number;
  checkedAt: string;
}

export const LINK_HEALTH_KEY = "links:health";
const RECHECK_OK_DAYS = 7;
const RECHECK_BAD_HOURS = 12;
const DEAD_AFTER_FAILURES = 3;
const MAX_REDIRECTS = 5;

export function linkHealthId(destination: string): string {
  return fnv1a(normalizeOfferUrl(destination));
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Skontroluje jednu cieľovú URL: HEAD (fallback GET), manuálne sledovanie redirectov. */
export async function checkUrl(url: string, fetcher: Fetcher = fetch): Promise<Omit<LinkHealth, "consecutiveFailures" | "checkedAt">> {
  let current = url;
  let redirects = 0;
  try {
    for (;;) {
      let res = await fetcher(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "ZlavickovoLinkCheck/1.0 (+https://www.zlavickovo.sk)" } });
      if (res.status === 405 || res.status === 403 || res.status === 501) {
        res = await fetcher(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "ZlavickovoLinkCheck/1.0 (+https://www.zlavickovo.sk)", Range: "bytes=0-0" } });
      }
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        if (++redirects > MAX_REDIRECTS) return { url, status: "warn", httpStatus: res.status, redirects, finalUrl: current, error: "príliš veľa presmerovaní" };
        current = new URL(loc, current).toString();
        continue;
      }
      const s = res.status;
      // 403/429 od anti-bot ochrany obchodu nie je mŕtvy odkaz → len varovanie.
      const status: LinkStatus = s >= 200 && s < 300 ? (redirects > 0 ? "redirect" : "ok") : s === 404 || s === 410 ? "dead" : "warn";
      return { url, status, httpStatus: s, redirects, finalUrl: current, error: status === "ok" || status === "redirect" ? null : `HTTP ${s}` };
    }
  } catch (e) {
    return { url, status: "warn", httpStatus: null, redirects, finalUrl: current, error: (e as Error)?.name === "TimeoutError" ? "timeout" : "sieťová chyba" };
  }
}

/** Zlúči nový výsledok s predchádzajúcim — "dead" až po opakovaných zlyhaniach. */
export function mergeHealth(prev: LinkHealth | null, next: Omit<LinkHealth, "consecutiveFailures" | "checkedAt">, now: number): LinkHealth {
  const failed = next.status === "dead" || next.status === "warn";
  const consecutiveFailures = failed ? (prev?.consecutiveFailures ?? 0) + 1 : 0;
  const status: LinkStatus = !failed ? next.status : consecutiveFailures >= DEAD_AFTER_FAILURES && next.status === "dead" ? "dead" : "warn";
  return { ...next, status, consecutiveFailures, checkedAt: new Date(now).toISOString() };
}

export function isDueForCheck(h: LinkHealth | undefined, now: number): boolean {
  if (!h) return true;
  const at = Date.parse(h.checkedAt) || 0;
  const wait = h.status === "ok" || h.status === "redirect" ? RECHECK_OK_DAYS * 86400_000 : RECHECK_BAD_HOURS * 3600_000;
  return now - at >= wait;
}

export async function getLinkHealthMap(kv: Kv = redisKv): Promise<Record<string, LinkHealth>> {
  return (await kv.hgetall<LinkHealth>(LINK_HEALTH_KEY).catch(() => null)) ?? {};
}

/** Je affiliate link prokazateľne mŕtvy (cieľ opakovane 404/410)? */
export function isAffiliateLinkDead(affiliateUrl: string, map: Record<string, LinkHealth>): boolean {
  const dest = destinationOf(affiliateUrl);
  return dest ? map[linkHealthId(dest)]?.status === "dead" : false;
}

export interface LinkCheckRun {
  checked: number;
  ok: number;
  warn: number;
  dead: number;
  skippedNoDestination: number;
  pending: number;
}

/** Skontroluje dávku splatných cieľových URL (rozpočet počtu aj času). */
export async function runLinkHealthBatch(
  affiliateUrls: string[],
  opts: { kv?: Kv; now?: () => number; budget?: number; deadline?: number; dryRun?: boolean; fetcher?: Fetcher } = {},
): Promise<LinkCheckRun> {
  const kv = opts.kv ?? redisKv;
  const now = opts.now ?? Date.now;
  const map = await getLinkHealthMap(kv);
  const dests = new Map<string, string>();
  let skippedNoDestination = 0;
  for (const u of affiliateUrls) {
    const d = destinationOf(u);
    if (!d) { skippedNoDestination++; continue; }
    dests.set(linkHealthId(d), d);
  }
  const due = [...dests.entries()].filter(([id]) => isDueForCheck(map[id], now()));
  const batch = due.slice(0, opts.budget ?? 20);
  const run: LinkCheckRun = { checked: 0, ok: 0, warn: 0, dead: 0, skippedNoDestination, pending: Math.max(0, due.length - batch.length) };
  const updates: Record<string, LinkHealth> = {};
  // Malá paralelizácia (4) — rôzne domény, žiadna záťaž jedného obchodu.
  for (let i = 0; i < batch.length; i += 4) {
    if (opts.deadline && now() > opts.deadline) { run.pending += batch.length - i; break; }
    const chunk = batch.slice(i, i + 4);
    const results = await Promise.all(chunk.map(([, url]) => checkUrl(url, opts.fetcher)));
    chunk.forEach(([id], j) => {
      const merged = mergeHealth(map[id] ?? null, results[j], now());
      updates[id] = merged;
      run.checked++;
      if (merged.status === "dead") run.dead++;
      else if (merged.status === "warn") run.warn++;
      else run.ok++;
    });
  }
  // Prune: záznamy, ktoré už nezodpovedajú žiadnej aktívnej ponuke.
  const stale = Object.keys(map).filter((id) => !dests.has(id));
  if (!opts.dryRun) {
    await kv.hset(LINK_HEALTH_KEY, updates);
    if (stale.length) await kv.hdel(LINK_HEALTH_KEY, ...stale);
  }
  return run;
}
