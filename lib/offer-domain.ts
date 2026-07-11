/**
 * Presné doménové párovanie kupónov/akcií k ponukám produktu — čistý modul
 * bez DB, siete a env (testovateľný samostatne, scripts/test-product-offers.ts).
 *
 * createShopMatcher (lib/shop-match.ts) zámerne odstrihuje TLD ("alza.sk" aj
 * "alza.cz" → "alza"), čo je správne pre shop stránky, ale NIE pre kupón pri
 * konkrétnej ponuke produktu: .sk kupón sa nesmie pripojiť k .cz obchodu.
 * Tu sa porovnáva celý host — zdroj bez doménového údaja (eHub/CJ nesú len
 * názov kampane) sa konzervatívne nepripojí vôbec.
 */

/** Zjednotený tvar naprieč zdrojmi kupónov/akcií. */
export interface OfferRecord {
  shopName: string;
  domain: string;
  code: string;
  title: string;
  link: string;
  validTo: string | null;
}

export interface ExactDomainCoupon {
  code: string;
  title: string;
  link: string;
  validTo: string | null;
}
export interface ExactDomainDeal {
  title: string;
  link: string;
  validTo: string | null;
}
export interface ExactDomainOffer {
  coupon: ExactDomainCoupon | null;
  deal: ExactDomainDeal | null;
}

export function notExpired(v: string | null): boolean {
  if (!v) return true;
  const d = new Date(v);
  if (isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

const EXACT_DOMAIN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

/**
 * Presný doménový kľúč: lowercase, bez protokolu, cesty a www, TLD ZOSTÁVA
 * ("https://www.Alza.sk/x" → "alza.sk"). null, ak hodnota nevyzerá ako doména
 * (napr. len názov kampane "Alza") — taká sa presne párovať nedá.
 */
export function exactDomainKey(value?: string | null): string | null {
  const host = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");
  return EXACT_DOMAIN_RE.test(host) ? host : null;
}

/**
 * Prvý platný kupón (kód + odkaz) a akcia (odkaz bez kódu) pre každú presnú
 * doménu. Expirované záznamy sa preskočia; falošné kupóny sa nevyrábajú
 * (žiadny match = doména v mape chýba).
 */
export function buildOffersByExactDomain(
  records: OfferRecord[],
  domains: string[]
): Map<string, ExactDomainOffer> {
  const index = new Map<string, ExactDomainOffer>();
  const wanted = new Set(domains.map(exactDomainKey).filter(Boolean) as string[]);
  if (wanted.size === 0) return index;

  for (const r of records) {
    if (!notExpired(r.validTo)) continue;
    const key = exactDomainKey(r.domain);
    if (!key || !wanted.has(key)) continue;
    const entry = index.get(key) ?? { coupon: null, deal: null };
    if (r.code && r.link && !entry.coupon) {
      entry.coupon = { code: r.code, title: r.title, link: r.link, validTo: r.validTo };
    } else if (!r.code && r.link && !entry.deal) {
      entry.deal = { title: r.title, link: r.link, validTo: r.validTo };
    }
    if (entry.coupon || entry.deal) index.set(key, entry);
  }

  return index;
}
