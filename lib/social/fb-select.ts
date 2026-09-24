/**
 * Facebook selection engine — čistý modul (scripts/test-facebook-engine.ts).
 *
 * Nie "náhodná ponuka": každý kandidát dostane skóre z reálnych signálov
 * a výber dňa je greedy s tvrdými cooldownmi a diverzitou.
 *
 * Cooldowny (odvodené z frekvencie ~3 posty/deň, ~250 aktívnych akcií, ~110 obchodov):
 *   ponuka     45 dní  (prakticky raz za život akcie)
 *   titulok    30 dní  (rovnaký text akcie v inom článku/obchode)
 *   obchod      3 dni  (napr. Tchibo má 10 akcií — nesmie ovládnuť feed)
 *   kategória   max 1× za deň a nie dvakrát po sebe
 *   šablóna    hook nie je z posledných 4 postov; celý text sa neopakuje 90 dní
 */
import { normalizeSearchText } from "@/lib/search-normalize";

export interface FbCandidate {
  /** Stabilný kľúč ponuky (actionKey, inak slug). */
  key: string;
  slug: string;
  shopSlug: string;
  shopName: string;
  title: string;
  discountPct: number | null;
  validTo: string | null;
  /** Kedy ponuka prvýkrát vznikla (článok). */
  firstSeenAt: string | null;
  imageSource: string | null;
  affiliateUrl: string;
  categoryId: string | null;
  /** Outbound kliky na obchod (all-time) — popularita obchodu. */
  shopClicks: number;
}

export interface FbHistoryEntry {
  key: string;
  slug: string;
  shopSlug: string | null;
  categoryId: string | null;
  titleKey: string | null;
  hookId: string | null;
  templateId: string | null;
  textHash: string | null;
  publishedAt: string;
}

export const COOLDOWN = {
  offerDays: 45,
  titleDays: 30,
  merchantDays: 3,
  merchantSoftDays: 14,
  recentHooks: 4,
  textDays: 90,
};

const DAY = 86_400_000;
const REAL_IMAGE = new Set(["dognet-banner", "cj-banner", "feed", "og-image"]);
const GENERIC_TITLE = /^(akcia|akčná ponuka( produktov)?|výpredaj|sale|zľava|zľavy|novinky)\.?$/i;

export function titleKey(shopSlug: string, title: string): string {
  const t = normalizeSearchText(title.replace(/^[^:]{1,40}:\s*/, ""));
  return `${shopSlug}|${t}`;
}

export interface ScoreParts {
  discount: number;
  freshness: number;
  merchant: number;
  image: number;
  quality: number;
  urgency: number;
  repeatPenalty: number;
}

export function scoreCandidate(c: FbCandidate, history: FbHistoryEntry[], now: number, maxClicks: number): { score: number; parts: ScoreParts } {
  const pct = c.discountPct != null && c.discountPct >= 5 ? Math.min(70, c.discountPct) : 0;
  const freeShipping = /doprav[auy]?\s+(zadarmo|zdarma)/i.test(c.title) ? 6 : 0;
  const discount = (pct / 70) * 35 + freeShipping;

  const first = c.firstSeenAt ? Date.parse(c.firstSeenAt) : NaN;
  const age = Number.isFinite(first) ? (now - first) / DAY : Infinity;
  const freshness = age <= 1 ? 20 : age <= 3 ? 15 : age <= 7 ? 10 : age <= 30 ? 4 : 0;

  const merchant = maxClicks > 0 ? (Math.log10(1 + c.shopClicks) / Math.log10(1 + maxClicks)) * 15 : 0;
  const image = c.imageSource && REAL_IMAGE.has(c.imageSource) ? 10 : c.imageSource ? 2 : 0;

  const title = c.title.replace(/^[^:]{1,40}:\s*/, "").trim();
  const words = title.split(/\s+/).filter(Boolean).length;
  const quality = GENERIC_TITLE.test(title) || words <= 2 ? -8 : title.length >= 20 && title.length <= 110 ? 5 : 0;

  const end = c.validTo ? Date.parse(c.validTo) : NaN;
  const daysLeft = Number.isFinite(end) ? (end - now) / DAY : null;
  const urgency = daysLeft != null && daysLeft >= 0.5 && daysLeft <= 4 ? 6 : 0;

  const lastShop = history
    .filter((h) => h.shopSlug === c.shopSlug)
    .reduce((m, h) => Math.max(m, Date.parse(h.publishedAt) || 0), 0);
  const repeatPenalty = lastShop && now - lastShop < COOLDOWN.merchantSoftDays * DAY ? -8 : 0;

  const parts = { discount, freshness, merchant, image, quality, urgency, repeatPenalty };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Number(score.toFixed(2)), parts };
}

export type SkipReason = "offer-cooldown" | "title-cooldown" | "merchant-cooldown" | "category-diversity" | "no-link";

/** Tvrdé cooldowny voči histórii (bez plánu dňa). */
export function cooldownReason(c: FbCandidate, history: FbHistoryEntry[], now: number): SkipReason | null {
  if (!/^https?:\/\//.test(c.affiliateUrl)) return "no-link";
  const tk = titleKey(c.shopSlug, c.title);
  for (const h of history) {
    const at = Date.parse(h.publishedAt) || 0;
    const age = now - at;
    if ((h.key === c.key || h.slug === c.slug) && age < COOLDOWN.offerDays * DAY) return "offer-cooldown";
    if (h.titleKey && h.titleKey === tk && age < COOLDOWN.titleDays * DAY) return "title-cooldown";
    if (h.shopSlug && h.shopSlug === c.shopSlug && age < COOLDOWN.merchantDays * DAY) return "merchant-cooldown";
  }
  return null;
}

export interface Selection {
  candidate: FbCandidate;
  score: number;
  parts: ScoreParts;
}

/**
 * Výber `count` postov na deň: najvyššie skóre, ale bez dvoch postov z toho
 * istého obchodu či kategórie v rámci dňa a bez rovnakej kategórie ako
 * posledný publikovaný post.
 */
export function selectPosts(candidates: FbCandidate[], history: FbHistoryEntry[], opts: { count: number; now: number }): { selected: Selection[]; eligible: number; skipped: Record<string, number> } {
  const { now } = opts;
  const maxClicks = candidates.reduce((m, c) => Math.max(m, c.shopClicks), 0);
  const skipped: Record<string, number> = {};
  const eligible: Selection[] = [];
  for (const c of candidates) {
    const reason = cooldownReason(c, history, now);
    if (reason) {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    eligible.push({ candidate: c, ...scoreCandidate(c, history, now, maxClicks) });
  }
  // Stabilné poradie: skóre, potom kľúč (deterministický výsledok pre rovnaký vstup).
  eligible.sort((a, b) => b.score - a.score || a.candidate.key.localeCompare(b.candidate.key));

  const lastPost = [...history].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const selected: Selection[] = [];
  const shops = new Set<string>();
  const cats = new Set<string>();
  const titles = new Set<string>();
  for (const s of eligible) {
    if (selected.length >= opts.count) break;
    const c = s.candidate;
    if (shops.has(c.shopSlug)) continue;
    const tk = titleKey(c.shopSlug, c.title);
    if (titles.has(tk)) continue;
    const cat = c.categoryId ?? `shop:${c.shopSlug}`;
    const prevCat = selected.length > 0 ? selected[selected.length - 1].candidate.categoryId : lastPost?.categoryId;
    if (cats.has(cat) || (c.categoryId && prevCat && c.categoryId === prevCat)) {
      skipped["category-diversity"] = (skipped["category-diversity"] ?? 0) + 1;
      continue;
    }
    selected.push(s);
    shops.add(c.shopSlug);
    cats.add(cat);
    titles.add(tk);
  }
  // Ak diverzita kategórií nedovolí naplniť deň, doplň najlepšie zvyšné z iných obchodov.
  if (selected.length < opts.count) {
    for (const s of eligible) {
      if (selected.length >= opts.count) break;
      const c = s.candidate;
      if (selected.includes(s) || shops.has(c.shopSlug) || titles.has(titleKey(c.shopSlug, c.title))) continue;
      selected.push(s);
      shops.add(c.shopSlug);
      titles.add(titleKey(c.shopSlug, c.title));
    }
  }
  return { selected, eligible: eligible.length, skipped };
}
