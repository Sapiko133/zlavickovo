import { redis } from "@/lib/redis";
import { getToken } from "@/lib/dognet";

/**
 * Resolver REÁLNYCH obrázkov pre akcie/kampane — žiadna AI grafika.
 *
 * Preferencia zdrojov (odsúhlasené):
 *   1. affiliate campaign creative  → Dognet /banners/filter (banner inzerenta)
 *   2. feed image                   → obrázok z produktového feedu (ak je)
 *   3. og:image z webu inzerenta    → <meta og:image> na doméne obchodu
 *   4. logo obchodu (favicon)       → fallback rieši UI, tu NEukladáme
 *
 * Do DB sa ukladá iba URL + zdroj (attribution), nikdy binárka.
 */

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415; // náš ad_channel (NIE 8875)

const CACHE_PREFIX = "action-image:v2:";
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 dní — reálny nález
const NEGATIVE_TTL = 60 * 60 * 24 * 3; // 3 dni — aby sme nespamovali siete

export type ActionImageSource = "dognet-banner" | "feed" | "og-image";

export interface ActionImage {
  url: string;
  source: ActionImageSource;
}

const BANNER_CACHE_KEY = "action-image:banners:v2";
const BANNER_MEMO_TTL = 60 * 60 * 1000; // 1h in-process

interface BannerEntry {
  url: string;
  area: number;
  tld: string; // trh kreatívy z názvu kampane (sk/cz/hu/…) na uprednostnenie rovnakého trhu
}

/** Normalizuj názov obchodu/kampane na porovnateľný kľúč (bez TLD a diakritiky). */
function normKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.(sk|cz|eu|com|pl|hu|at|de)$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Rozmery kreatívy z názvu bannera, napr. "Sizeer 300x250". */
function parseDims(name: string): number {
  const m = (name || "").match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
  return m ? Number(m[1]) * Number(m[2]) : 0;
}

/** Trh kreatívy z názvu kampane, napr. "Sizeer.cz" → "cz". */
function tldOf(name: string): string {
  const m = (name || "").toLowerCase().match(/\.(sk|cz|hu|pl|eu|com|at|de|hr|rs|bg|si|ro)\b/);
  return m ? m[1] : "";
}

const MAX_BANNER_PAGES = 12;
const PER_KEY_CAP = 4; // kandidátov na obchod (rôzne trhy/rozmery)

let bannerMemo: { at: number; map: Map<string, BannerEntry[]> } | null = null;

/**
 * Načíta VŠETKY bannery joined kampaní (Dognet, stránkované) a zmapuje ich na obchod.
 * Endpoint nepodporuje filter podľa campaign_name (vracia 400), preto stiahneme
 * všetky strany raz a matchujeme lokálne. Cache: Redis 24h + in-process 1h.
 */
async function loadBannerMap(): Promise<Map<string, BannerEntry[]>> {
  if (bannerMemo && Date.now() - bannerMemo.at < BANNER_MEMO_TTL) return bannerMemo.map;
  try {
    const cached = await redis.get<[string, BannerEntry[]][]>(BANNER_CACHE_KEY);
    if (cached && Array.isArray(cached)) {
      const map = new Map(cached);
      bannerMemo = { at: Date.now(), map };
      return map;
    }
  } catch {}

  const map = new Map<string, BannerEntry[]>();
  try {
    const token = await getToken();
    for (let page = 1; page <= MAX_BANNER_PAGES; page++) {
      const res = await fetch(`${API_BASE}/banners/filter?page=${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ad_channel_id: AD_CHANNEL_ID,
          from_joined_campaigns: true,
          expand: "campaign",
          "per-page": 1000,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) break;
      const data = await res.json();
      const arr: any[] = data?.data || [];
      for (const b of arr) {
        const img = b.image_url;
        // rtype "I" = obrázková kreatíva (nie HTML/flash).
        if (b.rtype !== "I" || typeof img !== "string" || !/^https?:\/\//.test(img)) continue;
        const campName = b.campaign?.name || b.name || "";
        const key = normKey(campName);
        if (!key) continue;
        const entry: BannerEntry = { url: img, area: parseDims(b.name || "") || 1, tld: tldOf(campName) };
        const list = map.get(key) || [];
        // Drž len najväčšie kreatívy na obchod (rôzne trhy/rozmery), max PER_KEY_CAP.
        if (!list.some((e) => e.url === entry.url)) {
          list.push(entry);
          list.sort((a, c) => c.area - a.area);
          if (list.length > PER_KEY_CAP) list.length = PER_KEY_CAP;
          map.set(key, list);
        }
      }
      if (arr.length < 1000) break;
    }
  } catch {}

  bannerMemo = { at: Date.now(), map };
  try {
    await redis.set(BANNER_CACHE_KEY, Array.from(map.entries()), { ex: 60 * 60 * 24 });
  } catch {}
  return map;
}

/** 1. Affiliate campaign creative — reálny banner inzerenta z Dognetu. */
async function dognetBanner(shopName: string, domain: string): Promise<string | null> {
  const map = await loadBannerMap();
  const targetTld = tldOf(domain);
  for (const key of [normKey(shopName), normKey(domain)]) {
    if (!key) continue;
    const list = map.get(key);
    if (!list || !list.length) continue;
    // Preferuj rovnaký trh (napr. SK akcia → SK kreatíva pred HU), inak najväčšiu.
    const sameMarket = targetTld ? list.find((e) => e.tld === targetTld) : undefined;
    return (sameMarket || list[0]).url;
  }
  return null;
}

/** 3. og:image z webu inzerenta (pôvodný obrázok, nie AI). */
async function ogImage(domain: string): Promise<string | null> {
  const base = `https://${domain}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(base, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZlavickovoBot/1.0; +https://www.zlavickovo.sk)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i);
    if (!m) return null;
    let img = m[1].trim();
    if (img.startsWith("//")) img = `https:${img}`;
    else if (img.startsWith("/")) img = `${new URL(base).origin}${img}`;
    return /^https?:\/\//.test(img) ? img : null;
  } catch {
    return null;
  }
}

export interface ResolveInput {
  shopName?: string;
  domain?: string;
  feedImage?: string | null;
}

/**
 * Vráti reálny obrázok akcie podľa preferencie zdrojov, alebo null (→ UI dá logo).
 * Výsledok (aj negatívny) cachuje v Redise podľa domény, aby cron neťahal siete opakovane.
 */
export async function resolveActionImage(input: ResolveInput): Promise<ActionImage | null> {
  const domain = (input.domain || "").toLowerCase();
  const cacheId = domain || (input.shopName || "").toLowerCase();
  const cacheKey = cacheId ? `${CACHE_PREFIX}${cacheId}` : "";

  if (cacheKey) {
    const cached = await redis.get<ActionImage | { none: true }>(cacheKey).catch(() => null);
    if (cached) return "none" in cached ? null : cached;
  }

  let result: ActionImage | null = null;

  // 1. Affiliate campaign creative
  const banner = await dognetBanner(input.shopName || "", domain);
  if (banner) result = { url: banner, source: "dognet-banner" };

  // 2. Feed image
  if (!result && input.feedImage && /^https?:\/\//.test(input.feedImage)) {
    result = { url: input.feedImage, source: "feed" };
  }

  // 3. og:image z webu inzerenta
  if (!result && domain) {
    const og = await ogImage(domain);
    if (og) result = { url: og, source: "og-image" };
  }

  if (cacheKey) {
    await redis
      .set(cacheKey, result ?? { none: true }, { ex: result ? CACHE_TTL : NEGATIVE_TTL })
      .catch(() => {});
  }

  return result;
}
