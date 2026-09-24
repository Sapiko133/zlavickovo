/**
 * Register obchodov pre SEO — jediné miesto, ktoré rozhoduje:
 *   - či /kupony/[slug] existuje (inak 404, žiadne soft-404),
 *   - aký je kanonický slug entity (aliasy "aboutyou"/"drmax"/"h-m" → 308),
 *   - na aký slug smie viesť interný odkaz (žiadne odkazy na 404).
 *
 * Zdroj pravdy: getAllKnownShops() (Dognet/eHub/CJ/Affial/kurátorské TOP_SHOPS)
 * + kurátorské TOP_SLUGS a SHOP_NAME_OVERRIDES + Affial partneri.
 */
import { cache } from "react";
import { getAllKnownShops, getStaticKnownShops, type KnownShop } from "@/lib/all-shops";
import { AFFIAL_SHOPS, findAffialShop } from "@/lib/affial-shops";
import { normalizeShopSlug } from "@/lib/slug";

/** Kurátorské veľké obchody — stránka je indexovateľná aj bez aktuálnej ponuky. */
export const TOP_SLUGS = [
  "alza", "shein", "zalando", "mall", "notino", "sportisimo",
  "ikea", "dedoles", "martinus", "about-you", "answear", "dr-max",
  "zara", "hm", "asos", "lidl", "kaufland", "decathlon", "nike", "adidas",
];

// Správne obchodné meno pre slugy, ktoré nie sú v žiadnom feede
// a kapitalizácia zo slugu by vyrobila nezmysel ("Czc" namiesto "CZC.cz")
export const SHOP_NAME_OVERRIDES: Record<string, string> = {
  czc: "CZC.cz",
  belda: "Belda Sport",
  "kojenecke-obleceni": "Kojenecké oblečenie",
  // CJ advertiser "AUKRO CZ/SK" → kanonický slug by bol "aukro-czsk" (škaredý
  // názov + rozbité favicon). Kurátorský slug "aukro" + správne meno; CTA
  // resolvuje getShopAffiliateUrl → getCjShopUrl("Aukro") na CJ tracking link.
  aukro: "Aukro",
  hm: "H&M",
  ikea: "IKEA",
};

/** Ručné aliasy slugov, ktoré sa nedajú odvodiť automaticky (alias → kanonický slug). */
const SLUG_ALIASES: Record<string, string> = {
  "h-m": "hm",
};

export interface ShopEntry {
  slug: string;
  name: string;
  domain: string;
  categoryId: KnownShop["categoryId"];
}

export interface ShopRegistry {
  bySlug: Map<string, ShopEntry>;
  /** Programové varianty tej istej entity ("bonprixsk-for-cashbacks") → kanonický slug. */
  aliases: Map<string, string>;
  /** "aboutyou" → "about-you", "drmax" → "dr-max" (kompaktný kľúč bez pomlčiek). */
  byCompact: Map<string, string>;
  /** Doména bez www → slug. */
  byDomain: Map<string, string>;
}

const compact = (s: string) => s.replace(/-/g, "");

/** Sieťové označenia programu v názve kampane — nie sú súčasťou mena obchodu. */
const PROGRAM_SUFFIX = /\s*\((?:for\s[^)]*|content[^)]*|cashback[^)]*|voucher[^)]*|p[ôo]vodne[^)]*)\)\s*$/i;

/**
 * Čitateľné meno obchodu pre title/H1/breadcrumbs:
 * "Bonprix.sk (for cashbacks)" → "Bonprix.sk", "CZ - Cropp.com" → "Cropp.com",
 * "2sport CZ/SK" → "2sport", "ASKO-NABYTOK.SK" → "Asko-nabytok.sk".
 */
export function seoShopName(raw: string): string {
  let n = raw.replace(PROGRAM_SUFFIX, "").trim();
  n = n.replace(/\s+-\s+medi[aá]lna kampa[nň]$/i, "");
  n = n.replace(/^(CZ|SK|HU|PL|RO)\s+-\s+/i, "");
  n = n.replace(/\s+(?:CZ|SK|HU|PL|RO)(?:[\/\s](?:CZ|SK|HU|PL|RO))*$/i, "");
  // "Canatura.com/cz" → "Canatura.com CZ", "Lego.com/sk-sk" → "Lego.com" (SK je primárny trh)
  const path = n.match(/^([^\s/]+\.[a-z]{2,})\/([a-z]{2})(?:[-/][a-z]{2,3})*\/?$/i);
  if (path) {
    const market = path[2].toLowerCase() === "cs" ? "cz" : path[2].toLowerCase();
    n = market === "sk" ? path[1] : `${path[1]} ${market.toUpperCase()}`;
  }
  if (n.length > 4 && n === n.toUpperCase() && /[A-Z]{4,}/.test(n)) {
    n = n.charAt(0) + n.slice(1).toLowerCase();
  }
  return n || raw;
}

function titleFromSlug(slug: string): string {
  const n = slug.replace(/-/g, " ");
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function build(shops: KnownShop[]): ShopRegistry {
  const bySlug = new Map<string, ShopEntry>();
  const add = (e: ShopEntry) => { if (e.slug && !bySlug.has(e.slug)) bySlug.set(e.slug, e); };

  for (const s of shops) add({ slug: s.slug, name: s.name, domain: s.domain, categoryId: s.categoryId });
  for (const a of AFFIAL_SHOPS) {
    add({ slug: normalizeShopSlug(a.domain), name: a.name, domain: a.domain, categoryId: null });
  }
  for (const slug of [...TOP_SLUGS, ...Object.keys(SHOP_NAME_OVERRIDES)]) {
    add({ slug, name: SHOP_NAME_OVERRIDES[slug] ?? titleFromSlug(slug), domain: "", categoryId: null });
  }
  // Kurátorské meno má prednosť pred menom z feedu ("H&M", "IKEA").
  for (const [slug, name] of Object.entries(SHOP_NAME_OVERRIDES)) {
    const e = bySlug.get(slug);
    if (e) e.name = name;
  }

  // Programové varianty ("Bonprix.sk (for cashbacks)") sú tá istá entita ako
  // "bonprix" — ak kanonický obchod existuje, variant je len alias (308, mimo sitemap).
  const aliases = new Map<string, string>(Object.entries(SLUG_ALIASES));
  for (const e of [...bySlug.values()]) {
    if (!PROGRAM_SUFFIX.test(e.name)) continue;
    const target = normalizeShopSlug(e.name.replace(PROGRAM_SUFFIX, ""));
    if (target && target !== e.slug && bySlug.has(target)) {
      aliases.set(e.slug, target);
      bySlug.delete(e.slug);
    }
  }
  for (const e of bySlug.values()) e.name = seoShopName(e.name);

  const byCompact = new Map<string, string>();
  const byDomain = new Map<string, string>();
  for (const e of bySlug.values()) {
    const k = compact(e.slug);
    // Pri kolízii má prednosť slug s pomlčkami (čitateľnejší, zvyčajne kurátorský).
    const prev = byCompact.get(k);
    if (!prev || (prev === k && e.slug !== k)) byCompact.set(k, e.slug);
    if (e.domain) byDomain.set(e.domain.replace(/^www\./, "").toLowerCase(), e.slug);
  }
  return { bySlug, aliases, byCompact, byDomain };
}

let memo: { at: number; data: Promise<ShopRegistry> } | null = null;
const MEMO_MS = 5 * 60 * 1000;

/**
 * Pod touto veľkosťou je register postavený len zo statického fallbacku
 * (živé zdroje/cache nedostupné) — sitemap ani SEO index z neho nesmú vzniknúť.
 */
export const MIN_HEALTHY_REGISTRY = 200;

export function isRegistryDegraded(reg: ShopRegistry): boolean {
  return reg.bySlug.size < MIN_HEALTHY_REGISTRY;
}

/** Register (memo 5 min v rámci inštancie + dedupe v rámci requestu). */
export const getShopRegistry = cache(async (): Promise<ShopRegistry> => {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.data;
  const data = getAllKnownShops()
    .catch(() => getStaticKnownShops())
    .then(build);
  memo = { at: Date.now(), data };
  // Degradovaný register (statický fallback) nememoizuj — ďalší request skúsi znova.
  data.then((r) => { if (isRegistryDegraded(r)) memo = null; }, () => { memo = null; });
  return data;
});

/**
 * Kanonický slug pre ľubovoľný vstup (slug/meno/doména), alebo null ak obchod
 * nemá stránku. Použi pri KAŽDOM internom odkaze na /kupony/[slug].
 */
export function resolveShopSlugSync(
  reg: ShopRegistry,
  input: { slug?: string | null; name?: string | null; domain?: string | null },
): string | null {
  const candidates = [
    input.slug?.toLowerCase(),
    input.name ? normalizeShopSlug(input.name) : null,
    input.domain ? normalizeShopSlug(input.domain.replace(/^www\./, "")) : null,
  ].filter((c): c is string => !!c);

  for (const c of candidates) {
    if (reg.aliases.has(c)) return reg.aliases.get(c)!;
    if (reg.bySlug.has(c)) return c;
  }
  if (input.domain) {
    const d = reg.byDomain.get(input.domain.replace(/^www\./, "").toLowerCase());
    if (d) return d;
  }
  for (const c of candidates) {
    const hit = reg.byCompact.get(compact(c));
    if (hit) return hit;
    for (const suffix of ["-sk", "-cz"]) {
      if (reg.bySlug.has(`${c}${suffix}`)) return `${c}${suffix}`;
    }
  }
  return null;
}

export async function resolveShopSlug(input: { slug?: string | null; name?: string | null; domain?: string | null }) {
  return resolveShopSlugSync(await getShopRegistry(), input);
}

/** Interný odkaz na stránku obchodu alebo null (radšej žiadny odkaz než 404). */
export async function shopHref(input: { slug?: string | null; name?: string | null; domain?: string | null }) {
  const slug = await resolveShopSlug(input);
  return slug ? `/kupony/${slug}` : null;
}

export type ShopSlugResolution =
  | { kind: "ok"; slug: string; baseSlug: string; isCzVariant: boolean; entry: ShopEntry }
  | { kind: "redirect"; to: string }
  | { kind: "notfound" };

/**
 * Rozhodnutie pre request na /kupony/[slug]:
 *  - ok        → render (baseSlug = kanonická entita, isCzVariant = historická "-cz" mutácia)
 *  - redirect  → 308 na kanonický slug (veľké písmená, aliasy)
 *  - notfound  → 404
 */
export async function resolveShopRequest(rawSlug: string): Promise<ShopSlugResolution> {
  let slug = rawSlug;
  try { slug = decodeURIComponent(rawSlug); } catch {}
  const reg = await getShopRegistry();
  const lower = slug.toLowerCase();

  const direct = (s: string): ShopSlugResolution | null => {
    const e = reg.bySlug.get(s) ?? (findAffialShop(s) ? reg.bySlug.get(normalizeShopSlug(findAffialShop(s)!.domain)) : undefined);
    if (e) return { kind: "ok", slug: s, baseSlug: e.slug, isCzVariant: false, entry: e };
    // historická CZ mutácia "/kupony/alza-cz" (len ak "-cz" nie je samostatný obchod)
    if (s.endsWith("-cz")) {
      const base = reg.bySlug.get(s.slice(0, -3));
      if (base) return { kind: "ok", slug: s, baseSlug: base.slug, isCzVariant: true, entry: base };
    }
    return null;
  };

  const hit = direct(lower);
  if (hit && hit.kind === "ok") {
    if (lower !== slug) return { kind: "redirect", to: `/kupony/${lower}` };
    return hit;
  }
  const canonical = resolveShopSlugSync(reg, { slug: lower });
  if (canonical && canonical !== slug) return { kind: "redirect", to: `/kupony/${canonical}` };
  return { kind: "notfound" };
}
