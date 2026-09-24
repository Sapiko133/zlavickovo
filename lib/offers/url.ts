/**
 * Normalizácia URL ponúk. Kanonická URL (identita/dedup/SEO) a outbound affiliate
 * URL sú ODLIŠNÉ entity: affiliate tracking sa tu nikdy neprepisuje ani neodstraňuje,
 * iba sa z neho bezpečne vyčíta cieľová URL obchodu.
 * Čistý modul (scripts/test-offer-url.ts).
 */
import { TRACKING_PARAMS } from "@/lib/seo/config";

/** Tracking redirecty affiliate sietí a parameter s cieľovou URL. */
const TRACKERS: Array<{ host: RegExp; params: string[] }> = [
  { host: /(^|\.)go\.dognet\.com$/i, params: ["url"] },
  { host: /(^|\.)ehub\.cz$/i, params: ["desturl"] },
  { host: /(^|\.)affial\.com$/i, params: ["desturl"] },
  // CJ deep-link domény
  { host: /(^|\.)(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|emjcd\.com|qksrv\.net)$/i, params: ["url", "u"] },
];

const EXTRA_TRACKING = ["dclid", "gbraid", "wbraid", "igshid", "_hsenc", "_hsmi", "mkt_tok", "srsltid"];
const DROP_PARAMS = new Set([...TRACKING_PARAMS, ...EXTRA_TRACKING].map((p) => p.toLowerCase()));

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/** Je URL tracking redirect affiliate siete (= monetizovaný odkaz)? */
export function isTrackedAffiliateUrl(url: string | null | undefined): boolean {
  const u = url ? parse(url) : null;
  return Boolean(u && TRACKERS.some((t) => t.host.test(u.hostname)));
}

/**
 * Cieľová URL obchodu z affiliate linku. Priamy odkaz na obchod vráti sám seba;
 * tracker bez čitateľného cieľa (napr. CJ /click-… bez ?url) vráti null.
 */
export function destinationOf(url: string | null | undefined): string | null {
  const u = url ? parse(url) : null;
  if (!u) return null;
  const tracker = TRACKERS.find((t) => t.host.test(u.hostname));
  if (!tracker) return u.toString();
  for (const p of tracker.params) {
    const v = u.searchParams.get(p);
    if (v && parse(v)) return parse(v)!.toString();
  }
  return null;
}

/**
 * Kanonická forma URL pre identitu/deduplikáciu: https, malé písmená hostu bez
 * "www.", bez fragmentu, bez UTM/click-id parametrov, zoradené parametre,
 * bez koncového lomítka. NIKDY sa nepoužíva ako outbound odkaz.
 */
export function normalizeOfferUrl(url: string): string {
  const u = parse(url);
  if (!u) return url.trim();
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !DROP_PARAMS.has(k.toLowerCase()) && !/^utm_/i.test(k))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const qs = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = u.pathname.replace(/\/+$/, "") || "";
  const port = u.port && u.port !== "443" && u.port !== "80" ? `:${u.port}` : "";
  return `https://${host}${port}${path}${qs}`;
}

/** Kanonická identita ponuky z affiliate linku (cieľ obchodu), alebo null. */
export function canonicalOfferUrl(affiliateUrl: string | null | undefined): string | null {
  const dest = destinationOf(affiliateUrl);
  return dest ? normalizeOfferUrl(dest) : null;
}
