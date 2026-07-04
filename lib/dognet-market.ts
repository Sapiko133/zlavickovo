/**
 * Dognet market filter — Variant A: slovenské Zlavickovo zobrazuje len SK a CZ trhy.
 *
 * Povolené:
 *   - domény .sk a .cz
 *   - globálne domény (.com/.eu/.ai/…), ktoré sú jasne SK/CZ variant:
 *       prefix „SK -" / „CZ -" v názve kampane,
 *       URL path začínajúci /sk, /sk-sk, /cs, /cs-cz, /cz…,
 *       subdoména sk. / cz.
 * Skryté: .hu/.pl/.ro/.hr/.si/.rs/.bg/.gr a ostatné cudzie trhy vrátane
 * globálnych domén bez SK/CZ signálu (mangooutlet.com/hu/hu, lego.com/pl-pl…).
 *
 * Kupóny majú navyše explicitné pole `countries` ({"397":"SK"}) — to má
 * prednosť pred doménovou heuristikou.
 */

const ALLOWED_COUNTRY_CODES = new Set(["SK", "CZ"]);

/** coupon.countries → true/false podľa kódov krajín, null keď signál chýba (prázdne []). */
export function dognetCountriesAllowed(countries: unknown): boolean | null {
  if (!countries || typeof countries !== "object") return null;
  const values = Object.values(countries as Record<string, unknown>)
    .map(v => String(v).trim().toUpperCase())
    .filter(Boolean);
  if (values.length === 0) return null;
  return values.some(v => ALLOWED_COUNTRY_CODES.has(v));
}

const NAME_PREFIX_SKCZ = /^\s*(?:SK|CZ)\s*-\s/;
// Prvý path segment SK/CZ variantu: /sk, /sk-sk, /sk/en, /cs, /cs-cz, /cz, /cz/cs…
const PATH_SEGMENT_SKCZ = /^(?:sk|cz|cs)(?:-[a-z]{2})?$/i;
// Názov kampane býva doména, často aj s path — "Mangooutlet.com/sk/en", "Lego.com/cs-cz".
// \p{L} kvôli diakritike v názvoch ("Bubulákovo.cz", "IntímneNákupy.sk").
const DOMAIN_LIKE = /^[\p{L}\p{N}][\p{L}\p{N}.-]*\.[a-z]{2,}(?:\/|$)/iu;

function parseHostAndFirstSegment(candidate: string): { host: string; firstSegment: string } | null {
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const firstSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return {
      host: url.hostname.toLowerCase().replace(/^www\./, ""),
      firstSegment: firstSegment.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Market kampane podľa názvu a URL. Keď z názvu ani URL nevieme vyčítať
 * žiadnu doménu, kampaň radšej ponecháme (trh sa nedá určiť).
 */
export function isDognetSkCzMarket(name?: string | null, url?: string | null): boolean {
  const rawName = String(name ?? "").trim();
  if (NAME_PREFIX_SKCZ.test(rawName)) return true;

  const candidates: string[] = [];
  const u = String(url ?? "").trim();
  if (u) candidates.push(u);
  const nameToken = rawName.split(/\s+/)[0] ?? "";
  if (DOMAIN_LIKE.test(nameToken)) candidates.push(nameToken);

  let sawDomain = false;
  for (const cand of candidates) {
    const parsed = parseHostAndFirstSegment(cand);
    if (!parsed) continue;
    sawDomain = true;
    const labels = parsed.host.split(".");
    const tld = labels[labels.length - 1];
    if (tld === "sk" || tld === "cz") return true;
    if (labels.length >= 3 && (labels[0] === "sk" || labels[0] === "cz")) return true;
    if (parsed.firstSegment && PATH_SEGMENT_SKCZ.test(parsed.firstSegment)) return true;
  }

  // Doména existuje, ale bez SK/CZ signálu → cudzí trh.
  return !sawDomain;
}

/** Kupón: primárne explicitné `countries`, fallback na doménovú heuristiku kampane. */
export function isAllowedDognetCoupon(c: {
  countries?: unknown;
  campaign?: { name?: string | null; url?: string | null } | null;
}): boolean {
  const byCountries = dognetCountriesAllowed(c?.countries);
  if (byCountries !== null) return byCountries;
  return isDognetSkCzMarket(c?.campaign?.name, c?.campaign?.url);
}
