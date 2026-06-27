import { getCoupons, getCashbackShops } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { redis } from "@/lib/redis";
import { LETAKY } from "@/lib/letaky";
import { createHash } from "crypto";

// Keyword → shop category mapping
const CATEGORY_MAP: Record<string, string[]> = {
  elektronika: ["alza", "mall", "datart", "nay", "okay", "planeo", "samsung", "apple", "lenovo"],
  mobil: ["alza", "mall", "datart", "nay", "samsung", "apple"],
  laptop: ["alza", "mall", "datart", "lenovo", "hp", "dell"],
  tv: ["alza", "mall", "datart", "okay", "planeo", "samsung"],
  parfum: ["notino", "dm", "bipa", "fann"],
  kozmetika: ["notino", "dm", "bipa", "fann", "vivantis"],
  oblecenie: ["zalando", "about you", "answear", "zara", "hm", "asos", "bonprix"],
  moda: ["zalando", "about you", "answear", "zara", "hm", "asos"],
  nike: ["zalando", "about you", "answear", "sportisimo", "decathlon"],
  adidas: ["zalando", "about you", "answear", "sportisimo", "decathlon"],
  sport: ["sportisimo", "decathlon", "intersport", "nike", "adidas"],
  knihy: ["martinus", "panta rhei", "alza"],
  nabytek: ["ikea", "mall", "4home", "obi"],
  dom: ["ikea", "mall", "4home", "obi", "hornbach"],
};

function getRelevantShops(query: string): string[] {
  const q = query.toLowerCase();
  const shops = new Set<string>();
  for (const [keyword, list] of Object.entries(CATEGORY_MAP)) {
    if (q.includes(keyword)) list.forEach(s => shops.add(s));
  }
  return [...shops];
}

function isLetakQuery(q: string): boolean {
  return /lid[l]|kaufland|tesco|billa|leták|letaky|akcie potraviny/i.test(q);
}

async function googleSearch(query: string) {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID || "5195c8422613748fc";
  if (!key) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query + " Slovakia zľava kupón")}&num=8&hl=sk`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    title: item.title,
    link: item.link,
    domain: new URL(item.link).hostname.replace("www.", ""),
    snippet: item.snippet,
    source: "google" as const,
  }));
}

export async function POST(req: Request) {
  const { q } = await req.json();
  if (!q?.trim()) return Response.json({ error: "Chýba dotaz" }, { status: 400 });

  const query = q.trim();
  const hash = createHash("md5").update(query.toLowerCase()).digest("hex");
  const cacheKey = `search_cache:${hash}`;

  // ── KROK 5: Redis cache ──
  try {
    const cached = await redis.get<any>(cacheKey);
    if (cached) return Response.json({ ...cached, fromCache: true });
  } catch {}

  const result: any = {
    query,
    coupons: [],
    cashback: [],
    letaky: [],
    webResults: [],
    feedProducts: [],
  };

  // ── KROK 1: Affiliate feedy (pripravená architektúra, zatiaľ prázdne) ──
  // result.feedProducts = await feedManager.search(query);

  // ── KROK 2: Kupóny (Dognet + Affial) ──
  try {
    const [dognetAll, affialAll] = await Promise.all([getCoupons(), getAffialCoupons()]);
    const relevantShops = getRelevantShops(query);
    const qLow = query.toLowerCase();

    result.coupons = [...dognetAll, ...affialAll].filter((c: any) => {
      const name = (c.campaign?.name || c.campaign_name || "").toLowerCase();
      const title = (c.title || c.name || "").toLowerCase();
      return (
        name.includes(qLow) ||
        title.includes(qLow) ||
        relevantShops.some(s => name.includes(s))
      );
    }).slice(0, 8).map((c: any) => ({
      id: c.id,
      shopName: c.campaign?.name || c.campaign_name || "Obchod",
      title: c.title || c.name,
      code: c.code || null,
      link: c.affiliate_link || c.url || "#",
      type: c.type,
    }));
  } catch {}

  // ── KROK 3: Cashback ──
  try {
    const shops = await getCashbackShops();
    const qLow = query.toLowerCase();
    result.cashback = shops.filter((s: any) =>
      s.name.toLowerCase().includes(qLow) || getRelevantShops(query).some(r => s.name.toLowerCase().includes(r))
    ).slice(0, 4);
  } catch {}

  // ── KROK 4: Letáky ──
  if (isLetakQuery(query)) {
    result.letaky = LETAKY.slice(0, 5).map(l => ({
      slug: l.slug, name: l.name, color: l.color, letter: l.letter,
    }));
  }

  // ── KROK 6: Google CSE (fallback) ──
  const hasResults = result.coupons.length > 0 || result.feedProducts.length > 0;
  if (!hasResults) {
    try {
      result.webResults = await googleSearch(query);
    } catch {}
  }

  // Cache na 30 dní (2592000s)
  try {
    await redis.set(cacheKey, result, { ex: 2592000 });
  } catch {}

  return Response.json(result);
}
