/**
 * Jednoduchý alerting bez platenej monitoring služby.
 *  - podmienky sa vyhodnocujú na konci každého ticku (čistá funkcia evaluateAlerts)
 *  - aktívne alerty: Redis hash `ops:alerts`; keď podmienka zmizne, alert sa vyrieši
 *  - notifikácia: existujúci Resend kanál (lib/email.ts) na ALERT_EMAIL — iba nový
 *    alert, eskalácia na critical, alebo pripomienka raz za 24 h
 */
import { redisKv, type Kv } from "@/lib/kv";
import { sendEmail } from "@/lib/email";
import type { FeedMeta } from "@/lib/feeds/engine";

export type AlertLevel = "warning" | "critical";

export interface AlertCondition {
  key: string;
  level: AlertLevel;
  message: string;
}

export interface ActiveAlert extends AlertCondition {
  firstAt: string;
  lastAt: string;
  count: number;
  notifiedAt: string | null;
  notifiedLevel: AlertLevel | null;
}

export const ALERTS_KEY = "ops:alerts";
const RESOLVED_KEY = "ops:alerts:resolved";
const REMIND_HOURS = 24;

export interface AlertInput {
  now: number;
  feeds: Array<FeedMeta & { maxIntervalMin?: number }>;
  articles?: { guardTriggered: boolean; deactivated: number; activeBefore?: number } | null;
  facebook?: { status: string; error?: string | null; failedLast3Days: number } | null;
  sitemap?: { shops: number | null; error?: string | null } | null;
  jobErrors?: Array<{ job: string; error: string | null }>;
}

export function evaluateAlerts(input: AlertInput): AlertCondition[] {
  const out: AlertCondition[] = [];
  const { now } = input;
  for (const f of input.feeds) {
    if (f.status === "disabled" || f.status === "never") continue;
    if (f.consecutiveErrors >= 3) {
      out.push({ key: `feed:${f.id}:errors`, level: "critical", message: `Feed ${f.label} zlyhal ${f.consecutiveErrors}× po sebe (${f.lastErrorKind}): ${f.lastError ?? ""}` });
    }
    const last = f.lastSuccessAt ? Date.parse(f.lastSuccessAt) : NaN;
    const staleLimit = Math.max(36 * 60, 2 * (f.maxIntervalMin ?? f.intervalMin)) * 60_000;
    if (Number.isFinite(last) && now - last > staleLimit) {
      out.push({ key: `feed:${f.id}:stale`, level: "critical", message: `Feed ${f.label} nemá úspešnú aktualizáciu od ${f.lastSuccessAt} — web ukazuje posledné validné dáta` });
    }
    if (f.pendingDrop) {
      const pct = f.lastSuccessItemCount > 0 ? Math.round((1 - f.pendingDrop.count / f.lastSuccessItemCount) * 100) : 100;
      out.push({ key: `feed:${f.id}:drop`, level: "warning", message: `Feed ${f.label} náhle klesol o ${pct} % (${f.lastSuccessItemCount} → ${f.pendingDrop.count}), potvrdenie ${f.pendingDrop.seen}/3` });
    }
    if (f.lastErrorKind === "empty") {
      out.push({ key: `feed:${f.id}:empty`, level: "warning", message: `Feed ${f.label} vrátil 0 položiek — ponechané posledné validné dáta` });
    }
  }
  if (input.articles?.guardTriggered) {
    out.push({ key: "offers:mass-expire", level: "critical", message: "Nezvyčajne veľa akcií by skončilo naraz — deaktivácia pozastavená (skontroluj feedy)" });
  } else if (input.articles && input.articles.deactivated >= 40) {
    out.push({ key: "offers:expire-spike", level: "warning", message: `V jednom behu skončilo ${input.articles.deactivated} akcií` });
  }
  if (input.facebook) {
    if (/\(190\)|token/i.test(input.facebook.error ?? "")) {
      out.push({ key: "facebook:token", level: "critical", message: `Facebook token je neplatný/expirovaný: ${input.facebook.error}` });
    }
    if (input.facebook.failedLast3Days >= 2) {
      out.push({ key: "facebook:failing", level: "critical", message: `Facebook publikovanie zlyhalo ${input.facebook.failedLast3Days}× za 3 dni` });
    } else if (input.facebook.status === "failed" || input.facebook.status === "unknown") {
      out.push({ key: "facebook:failed", level: "warning", message: `Facebook post zlyhal: ${input.facebook.error ?? input.facebook.status}` });
    }
  }
  if (input.sitemap) {
    if (input.sitemap.error) out.push({ key: "sitemap:error", level: "critical", message: `Generovanie sitemap zlyháva: ${input.sitemap.error}` });
    else if (input.sitemap.shops != null && input.sitemap.shops < 100) out.push({ key: "sitemap:degraded", level: "critical", message: `Sitemap obchodov má len ${input.sitemap.shops} URL (poistka vracia 503)` });
  }
  for (const j of input.jobErrors ?? []) {
    out.push({ key: `job:${j.job}`, level: "warning", message: `Job ${j.job} skončil chybou: ${j.error ?? ""}` });
  }
  return out;
}

export interface AlertSyncResult {
  active: number;
  opened: string[];
  resolved: string[];
  notified: boolean;
}

export async function syncAlerts(conditions: AlertCondition[], opts: { kv?: Kv; now?: number; dryRun?: boolean; notify?: (subject: string, text: string) => Promise<boolean> } = {}): Promise<AlertSyncResult> {
  const kv = opts.kv ?? redisKv;
  const now = opts.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const current = (await kv.hgetall<ActiveAlert>(ALERTS_KEY).catch(() => null)) ?? {};
  const next: Record<string, ActiveAlert> = {};
  const opened: string[] = [];
  const toNotify: ActiveAlert[] = [];
  for (const c of conditions) {
    const prev = current[c.key];
    const a: ActiveAlert = prev
      ? { ...prev, ...c, lastAt: nowIso, count: prev.count + 1 }
      : { ...c, firstAt: nowIso, lastAt: nowIso, count: 1, notifiedAt: null, notifiedLevel: null };
    if (!prev) opened.push(c.key);
    const escalated = a.notifiedLevel === "warning" && a.level === "critical";
    const remind = a.notifiedAt && now - Date.parse(a.notifiedAt) > REMIND_HOURS * 3600_000;
    if (!a.notifiedAt || escalated || remind) toNotify.push(a);
    next[c.key] = a;
  }
  const resolved = Object.keys(current).filter((k) => !next[k]);

  let notified = false;
  if (toNotify.length && !opts.dryRun) {
    const notify = opts.notify ?? defaultNotify;
    const subject = `[Zlavickovo] ${toNotify.some((a) => a.level === "critical") ? "KRITICKÉ" : "Upozornenie"}: ${toNotify.length} alert(y)`;
    const text = [
      ...toNotify.map((a) => `• [${a.level}] ${a.message} (od ${a.firstAt})`),
      "",
      "Prehľad: https://www.zlavickovo.sk/admin/ops",
    ].join("\n");
    notified = await notify(subject, text).catch(() => false);
    if (notified) for (const a of toNotify) Object.assign(next[a.key], { notifiedAt: nowIso, notifiedLevel: a.level });
  }

  if (!opts.dryRun) {
    if (Object.keys(next).length) await kv.hset(ALERTS_KEY, next);
    if (resolved.length) {
      await kv.hdel(ALERTS_KEY, ...resolved);
      for (const k of resolved) await kv.lpush(RESOLVED_KEY, { ...current[k], resolvedAt: nowIso });
      await kv.ltrim(RESOLVED_KEY, 0, 99);
    }
  }
  return { active: Object.keys(next).length, opened, resolved, notified };
}

async function defaultNotify(subject: string, text: string): Promise<boolean> {
  const to = process.env.ALERT_EMAIL?.trim();
  if (!to) return false;
  const res = await sendEmail({ to, subject, text });
  return res.sent;
}

export async function getActiveAlerts(kv: Kv = redisKv): Promise<ActiveAlert[]> {
  const map = (await kv.hgetall<ActiveAlert>(ALERTS_KEY).catch(() => null)) ?? {};
  return Object.values(map).sort((a, b) => (a.level === b.level ? b.lastAt.localeCompare(a.lastAt) : a.level === "critical" ? -1 : 1));
}

export async function getResolvedAlerts(kv: Kv = redisKv, limit = 20): Promise<Array<ActiveAlert & { resolvedAt: string }>> {
  return kv.lrange<ActiveAlert & { resolvedAt: string }>(RESOLVED_KEY, 0, limit - 1).catch(() => []);
}
