import { HEUREKA_FEEDS } from "./feeds";

/**
 * Slug → doména pre obchody z Heureka feedov (§18: feed shop má mať shop stránku).
 * Doteraz shop stránky poznali len kupónové/affiliate obchody (getShopDomain
 * DOMAIN_MAP) → feed shopy bez kupónového záznamu vracali 404.
 *
 * Konvencia slugov (zhodná so shop stránkou):
 *  - base = doména bez TLD ("tokrahome.cz" → "tokrahome", "divadlo-kufrik.sk" → "divadlo-kufrik")
 *  - .sk/.cz súrodenci: base slug = .sk (alebo jediná doména), base+"-cz" = .cz varianta
 *    ("kolagendrink" → kolagendrink.sk, "kolagendrink-cz" → kolagendrink.cz)
 */
let _map: Map<string, string> | null = null;

function build(): Map<string, string> {
  if (_map) return _map;
  const byBase = new Map<string, { sk?: string; cz?: string; other?: string }>();
  for (const f of HEUREKA_FEEDS) {
    const dom = f.domain.replace(/^www\./, "");
    const m = dom.match(/^(.+?)\.([a-z.]+)$/);
    if (!m) continue;
    const base = m[1];
    const tld = m[2];
    const e = byBase.get(base) ?? {};
    if (tld === "sk") e.sk = dom;
    else if (tld === "cz") e.cz = dom;
    else e.other = e.other ?? dom;
    byBase.set(base, e);
  }
  const map = new Map<string, string>();
  for (const [base, e] of byBase) {
    const primary = e.sk ?? e.cz ?? e.other;
    if (primary) map.set(base, primary);
    if (e.cz && (e.sk || e.other)) map.set(`${base}-cz`, e.cz); // .cz varianta popri inej
  }
  _map = map;
  return map;
}

/** Doména feed shopu pre daný slug, alebo null. */
export function feedShopDomainForSlug(slug: string): string | null {
  return build().get(slug.toLowerCase()) ?? null;
}
