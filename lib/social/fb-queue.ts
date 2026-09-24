/**
 * Facebook queue — plánovanie a idempotentné publikovanie.
 *
 * Stavy: candidate (vypočítaný pool) → selected → scheduled → publishing →
 *        published | failed | skipped
 *
 * Idempotencia / duplicate protection:
 *  - plán dňa sa vytvorí iba raz (Redis NX kľúč fb:plan:{deň})
 *  - publikovanie položky drží NX lock; stav "publishing" sa zapíše PRED volaním API
 *  - keď job spadne po publikovaní (alebo API timeout), položka ostane "publishing";
 *    ďalší tick ju NEpublikuje znova, ale overí cez Graph API (published_posts),
 *    či post existuje. Ak sa to overiť nedá → "failed" (manuálna kontrola), nikdy
 *    slepý repost.
 *  - max 1 post za tick a min. rozostup medzi postami → žiadne dávky naraz
 */
import { fnv1a, type Kv } from "@/lib/kv";
import { safeErrorMessage } from "@/lib/jobs/log";
import { buildPost } from "./fb-copy";
import { selectPosts, titleKey, type FbCandidate, type FbHistoryEntry } from "./fb-select";
import { GraphError } from "./fb-graph";

export type FbItemStatus = "scheduled" | "publishing" | "published" | "failed" | "skipped";

export interface FbQueueItem {
  id: string;
  planDate: string;
  offerKey: string;
  slug: string;
  shopSlug: string;
  shopName: string;
  categoryId: string | null;
  titleKey: string;
  templateId: string;
  hookId: string;
  text: string;
  textHash: string;
  imageUrl: string;
  link: string;
  score: number;
  scheduledAt: string;
  status: FbItemStatus;
  publishingAt?: string | null;
  publishedAt?: string | null;
  postId?: string | null;
  error?: string | null;
  retryCount: number;
  updatedAt: string;
}

export const FB_QUEUE_KEY = "fb:queue:v2";
export const FB_LEGACY_POSTED_KEY = "facebook:posted-actions";
const planKey = (date: string) => `fb:plan:${date}`;
const lockKey = (id: string) => `fb:lock:${id}`;
const QUEUE_RETENTION_DAYS = 100;
const MAX_RETRIES = 3;
const STUCK_AFTER_MIN = 10;
const STALE_SLOT_HOURS = 10;

export interface FbDeps {
  kv: Kv;
  now: () => number;
  loadCandidates: () => Promise<FbCandidate[]>;
  /** Legacy história (pred queue v2): slug → publishedAt + metadáta z článkov. */
  loadLegacyHistory: () => Promise<FbHistoryEntry[]>;
  /** null = môže ísť von; inak dôvod preskočenia (akcia skončila, duplikát, mŕtvy link…). */
  checkEligible: (item: FbQueueItem) => Promise<string | null>;
  publish: (item: FbQueueItem) => Promise<string>;
  /** Nájde už publikovaný post položky; vyhodí, keď overenie nie je možné. */
  verify: (item: FbQueueItem) => Promise<string | null>;
  imageUrlFor: (slug: string) => string;
  /** Verejná stránka ponuky na Zlavickovo — nikdy nie affiliate URL siete. */
  linkFor: (c: Pick<FbCandidate, "slug">) => string;
}

/**
 * Položky naplánované pred prechodom na verejné URL nesú v texte priamy
 * affiliate odkaz → prepíše ho na stránku Zlavickovo. Vráti dôvod preskočenia,
 * ak by v texte ostal akýkoľvek odkaz mimo webu Zlavickovo.
 */
export function ensurePublicLink(item: FbQueueItem, link: string): string | null {
  if (item.link !== link) {
    if (item.link) item.text = item.text.split(item.link).join(link);
    item.link = link;
    item.textHash = fnv1a(item.text);
  }
  const origin = new URL(link).origin;
  const foreign = (item.text.match(/https?:\/\/[^\s]+/g) ?? []).some((u) => u !== origin && !u.startsWith(`${origin}/`));
  return foreign ? "externý odkaz v texte postu" : null;
}

export interface FbSettings {
  postsPerDay: number;
  /** Lokálne časy (Europe/Bratislava) "HH:MM". */
  slots: string[];
  minGapMin: number;
  maxPerTick: number;
  quietStartHour: number;
  quietEndHour: number;
}

export function fbSettingsFromEnv(): FbSettings {
  const perDay = Number(process.env.FACEBOOK_POSTS_PER_DAY ?? process.env.FACEBOOK_POST_LIMIT ?? 3);
  const slots = (process.env.FACEBOOK_POST_SLOTS || "08:00,12:00,17:00").split(",").map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s));
  return {
    postsPerDay: Number.isFinite(perDay) ? Math.min(6, Math.max(0, Math.floor(perDay))) : 3,
    slots: slots.length ? slots : ["08:00", "12:00", "17:00"],
    minGapMin: 120,
    maxPerTick: 1,
    quietStartHour: 22,
    quietEndHour: 7,
  };
}

// ── Lokálny čas (Europe/Bratislava) ──────────────────────────────────────────

const TZ = "Europe/Bratislava";

export function localDate(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

export function localHour(ms: number): number {
  return Number(new Date(ms).toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: TZ })) % 24;
}

/** UTC ms lokálneho času HH:MM v deň `date` (DST-správne cez offset daného okamihu). */
export function localSlotMs(date: string, hhmm: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return guess - (asUtc - guess);
}

// ── História a fronta ────────────────────────────────────────────────────────

export async function loadQueue(kv: Kv): Promise<FbQueueItem[]> {
  const map = (await kv.hgetall<FbQueueItem>(FB_QUEUE_KEY).catch(() => null)) ?? {};
  return Object.values(map).filter((i): i is FbQueueItem => Boolean(i?.id));
}

function historyFromQueue(items: FbQueueItem[]): FbHistoryEntry[] {
  return items
    .filter((i) => i.status === "published" || i.status === "publishing")
    .map((i) => ({
      key: i.offerKey,
      slug: i.slug,
      shopSlug: i.shopSlug,
      categoryId: i.categoryId,
      titleKey: i.titleKey,
      hookId: i.hookId,
      templateId: i.templateId,
      textHash: i.textHash,
      publishedAt: i.publishedAt || i.publishingAt || i.scheduledAt,
    }));
}

export async function getFbHistory(deps: FbDeps, queue?: FbQueueItem[]): Promise<FbHistoryEntry[]> {
  const items = queue ?? (await loadQueue(deps.kv));
  const legacy = await deps.loadLegacyHistory().catch(() => []);
  const fromQueue = historyFromQueue(items);
  const known = new Set(fromQueue.map((h) => h.slug));
  return [...fromQueue, ...legacy.filter((h) => !known.has(h.slug))].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export interface PlanResult {
  status: "planned" | "already-planned" | "no-slots" | "no-candidates" | "disabled";
  date: string;
  items: FbQueueItem[];
  candidates: number;
  eligible: number;
  skipped: Record<string, number>;
}

/** Naplánuje posty na dnešok (raz za deň). */
export async function planDay(deps: FbDeps, settings: FbSettings, opts: { dryRun?: boolean } = {}): Promise<PlanResult> {
  const now = deps.now();
  const date = localDate(now);
  const base: PlanResult = { status: "planned", date, items: [], candidates: 0, eligible: 0, skipped: {} };
  if (settings.postsPerDay <= 0) return { ...base, status: "disabled" };

  const slots = settings.slots
    .map((s) => localSlotMs(date, s))
    .filter((ms) => ms >= now - 2 * 3600_000)
    .slice(0, settings.postsPerDay);
  if (slots.length === 0) return { ...base, status: "no-slots" };

  if (!opts.dryRun) {
    const acquired = await deps.kv.set(planKey(date), new Date(now).toISOString(), { nx: true, ex: 3 * 86400 });
    if (!acquired) return { ...base, status: "already-planned" };
  }

  try {
    const queue = await loadQueue(deps.kv);
    const pending = queue.filter((i) => i.status === "scheduled" || i.status === "publishing");
    const history = await getFbHistory(deps, queue);
    // Naplánované, ešte nepublikované posty sa správajú ako história (cooldown obchodu/ponuky).
    const pseudo: FbHistoryEntry[] = pending.map((i) => ({ key: i.offerKey, slug: i.slug, shopSlug: i.shopSlug, categoryId: i.categoryId, titleKey: i.titleKey, hookId: i.hookId, templateId: i.templateId, textHash: i.textHash, publishedAt: i.scheduledAt }));
    const candidates = await deps.loadCandidates();
    const { selected, eligible, skipped } = selectPosts(candidates, [...history, ...pseudo], { count: slots.length, now });
    if (selected.length === 0) {
      if (!opts.dryRun) await deps.kv.del(planKey(date));
      return { ...base, status: "no-candidates", candidates: candidates.length, eligible, skipped };
    }

    const recentHooks = new Set(history.slice(0, 4).map((h) => h.hookId).filter(Boolean) as string[]);
    const recentTemplates = new Set(history.slice(0, 12).map((h) => h.templateId).filter(Boolean) as string[]);
    const usedTexts = new Set(history.filter((h) => now - Date.parse(h.publishedAt) < 90 * 86400_000).map((h) => h.textHash));
    const nowIso = new Date(now).toISOString();

    const items: FbQueueItem[] = selected.map((s, idx) => {
      const c = s.candidate;
      const link = deps.linkFor(c);
      let post = buildPost(
        { shopName: c.shopName, title: c.title, discountPct: c.discountPct, validTo: c.validTo, categoryId: c.categoryId, firstSeenAt: c.firstSeenAt, link },
        { seed: `${c.key}|${date}`, now, avoidHooks: recentHooks, avoidTemplates: recentTemplates },
      );
      for (let n = 1; n <= 5 && usedTexts.has(post.textHash); n++) {
        post = buildPost(
          { shopName: c.shopName, title: c.title, discountPct: c.discountPct, validTo: c.validTo, categoryId: c.categoryId, firstSeenAt: c.firstSeenAt, link },
          { seed: `${c.key}|${date}|${n}`, now, avoidHooks: recentHooks, avoidTemplates: recentTemplates },
        );
      }
      recentHooks.add(post.hookId);
      recentTemplates.add(post.templateId);
      usedTexts.add(post.textHash);
      return {
        id: `${date}-${idx}-${fnv1a(c.key)}`,
        planDate: date,
        offerKey: c.key,
        slug: c.slug,
        shopSlug: c.shopSlug,
        shopName: c.shopName,
        categoryId: c.categoryId,
        titleKey: titleKey(c.shopSlug, c.title),
        templateId: post.templateId,
        hookId: post.hookId,
        text: post.text,
        textHash: post.textHash,
        imageUrl: deps.imageUrlFor(c.slug),
        link,
        score: s.score,
        scheduledAt: new Date(slots[idx]).toISOString(),
        status: "scheduled",
        retryCount: 0,
        updatedAt: nowIso,
      };
    });

    if (!opts.dryRun) {
      await deps.kv.hset(FB_QUEUE_KEY, Object.fromEntries(items.map((i) => [i.id, i])));
      // Retencia: staré uzavreté položky drž len kvôli cooldownom (max 100 dní).
      const cutoff = now - QUEUE_RETENTION_DAYS * 86400_000;
      const old = queue.filter((i) => i.status !== "scheduled" && i.status !== "publishing" && Date.parse(i.updatedAt) < cutoff).map((i) => i.id);
      if (old.length) await deps.kv.hdel(FB_QUEUE_KEY, ...old);
    }
    return { ...base, items, candidates: candidates.length, eligible, skipped };
  } catch (e) {
    if (!opts.dryRun) await deps.kv.del(planKey(date)).catch(() => {});
    throw e;
  }
}

export interface PublishResult {
  status: "published" | "idle" | "quiet-hours" | "gap" | "dry-run" | "locked" | "skipped" | "failed" | "retry" | "unknown" | "disabled";
  item?: Pick<FbQueueItem, "id" | "slug" | "shopName" | "text" | "scheduledAt">;
  postId?: string;
  error?: string;
  recovered: number;
  skippedStale: number;
}

async function saveItem(kv: Kv, item: FbQueueItem, now: number) {
  item.updatedAt = new Date(now).toISOString();
  await kv.hset(FB_QUEUE_KEY, { [item.id]: item });
}

/** Zotavenie položiek, ktoré ostali v stave "publishing" (pád/timeout po odoslaní). */
async function recoverStuck(deps: FbDeps, items: FbQueueItem[], now: number, dryRun: boolean): Promise<number> {
  let recovered = 0;
  for (const item of items.filter((i) => i.status === "publishing")) {
    const since = Date.parse(item.publishingAt || item.updatedAt) || 0;
    if (now - since < STUCK_AFTER_MIN * 60_000) continue; // môže práve bežať iný tick
    if (dryRun) continue;
    try {
      const found = await deps.verify(item);
      if (found) {
        Object.assign(item, { status: "published", postId: found, publishedAt: item.publishingAt, error: null });
      } else if (item.retryCount + 1 < MAX_RETRIES) {
        Object.assign(item, { status: "scheduled", retryCount: item.retryCount + 1, scheduledAt: new Date(now).toISOString() });
      } else {
        Object.assign(item, { status: "failed", error: item.error ?? "Publikovanie sa nepodarilo overiť" });
      }
    } catch (e) {
      Object.assign(item, { status: "failed", error: `Stav publikovania neznámy — skontroluj stránku ručne (${safeErrorMessage(e)})` });
    }
    await saveItem(deps.kv, item, now);
    recovered++;
  }
  return recovered;
}

/** Publikuje najviac `maxPerTick` splatných postov. */
export async function publishDue(deps: FbDeps, settings: FbSettings, opts: { dryRun?: boolean; enabled?: boolean } = {}): Promise<PublishResult> {
  const now = deps.now();
  const dryRun = Boolean(opts.dryRun);
  const items = await loadQueue(deps.kv);
  const recovered = await recoverStuck(deps, items, now, dryRun);
  const result: PublishResult = { status: "idle", recovered, skippedStale: 0 };
  if (opts.enabled === false) return { ...result, status: "disabled" };

  const hour = localHour(now);
  if (hour >= settings.quietStartHour || hour < settings.quietEndHour) return { ...result, status: "quiet-hours" };

  const history = await getFbHistory(deps, items);
  const lastAt = history.reduce((m, h) => Math.max(m, Date.parse(h.publishedAt) || 0), 0);
  if (lastAt && now - lastAt < settings.minGapMin * 60_000) return { ...result, status: "gap" };

  const due = items
    .filter((i) => i.status === "scheduled" && Date.parse(i.scheduledAt) <= now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  let published = 0;
  for (const item of due) {
    if (published >= settings.maxPerTick) break;
    // Slot dávno prešiel (napr. výpadok cronu) — nepostuj ranný obsah v noci, nerob dávku.
    if (now - Date.parse(item.scheduledAt) > STALE_SLOT_HOURS * 3600_000) {
      if (!dryRun) {
        Object.assign(item, { status: "skipped", error: "slot-expired" });
        await saveItem(deps.kv, item, now);
      }
      result.skippedStale++;
      continue;
    }
    const reason = ensurePublicLink(item, deps.linkFor(item))
      ?? (await deps.checkEligible(item).catch((e) => `eligibility-error: ${safeErrorMessage(e)}`));
    if (reason) {
      if (!dryRun) {
        Object.assign(item, { status: "skipped", error: reason });
        await saveItem(deps.kv, item, now);
      }
      result.status = "skipped";
      result.item = pickPublic(item);
      result.error = reason;
      continue;
    }
    if (dryRun) return { ...result, status: "dry-run", item: pickPublic(item) };

    if (!(await deps.kv.set(lockKey(item.id), now, { nx: true, ex: 300 }))) return { ...result, status: "locked" };
    try {
      // Stav "publishing" PRED volaním API — pri páde po publikovaní nedôjde k repostu.
      Object.assign(item, { status: "publishing", publishingAt: new Date(now).toISOString(), error: null });
      await saveItem(deps.kv, item, now);
      const postId = await deps.publish(item);
      Object.assign(item, { status: "published", postId, publishedAt: new Date(deps.now()).toISOString() });
      await saveItem(deps.kv, item, deps.now());
      published++;
      return { ...result, status: "published", item: pickPublic(item), postId };
    } catch (e) {
      const g = e instanceof GraphError ? e : new GraphError(safeErrorMessage(e), { ambiguous: true, retryable: true });
      const error = safeErrorMessage(g);
      if (g.ambiguous) {
        // Ostáva "publishing" → ďalší tick overí cez published_posts.
        Object.assign(item, { error });
        await saveItem(deps.kv, item, now);
        return { ...result, status: "unknown", item: pickPublic(item), error };
      }
      if (g.retryable && item.retryCount + 1 < MAX_RETRIES) {
        Object.assign(item, { status: "scheduled", error, retryCount: item.retryCount + 1, scheduledAt: new Date(now + 30 * 60_000 * 2 ** item.retryCount).toISOString(), publishingAt: null });
        await saveItem(deps.kv, item, now);
        return { ...result, status: "retry", item: pickPublic(item), error };
      }
      Object.assign(item, { status: "failed", error, publishingAt: null });
      await saveItem(deps.kv, item, now);
      return { ...result, status: "failed", item: pickPublic(item), error };
    } finally {
      await deps.kv.del(lockKey(item.id)).catch(() => {});
    }
  }
  return result;
}

function pickPublic(i: FbQueueItem) {
  return { id: i.id, slug: i.slug, shopName: i.shopName, text: i.text, scheduledAt: i.scheduledAt };
}

export function queueStats(items: FbQueueItem[]): Record<FbItemStatus, number> {
  const out: Record<FbItemStatus, number> = { scheduled: 0, publishing: 0, published: 0, failed: 0, skipped: 0 };
  for (const i of items) out[i.status] = (out[i.status] ?? 0) + 1;
  return out;
}
