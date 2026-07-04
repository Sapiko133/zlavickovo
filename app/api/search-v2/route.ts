import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import { getCjCoupons } from "@/lib/cj";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { STATIC_AKCIE } from "@/lib/akcie";
import { redis } from "@/lib/redis";
import { LETAKY } from "@/lib/letaky";
import { createHash } from "crypto";

const CATEGORY_MAP: Record<string, string[]> = {
  elektronika: ["alza", "mall", "datart", "nay", "okay", "planeo", "samsung", "apple", "lenovo"],
  mobil: ["alza", "mall", "datart", "nay", "samsung", "apple"],
  laptop: ["alza", "mall", "datart", "lenovo", "hp", "dell"],
  tv: ["alza", "mall", "datart", "okay", "planeo", "samsung"],
  parfum: ["notino", "dm", "bipa", "fann"],
  kozmetika: ["notino", "dm", "bipa", "fann", "vivantis"],
  krém: ["notino", "dm", "bipa", "fann", "vivantis"],
  krem: ["notino", "dm", "bipa", "fann", "vivantis"],
  oblecenie: ["zalando", "about you", "answear", "zara", "hm", "asos", "bonprix"],
  moda: ["zalando", "about you", "answear", "zara", "hm", "asos"],
  nike: ["zalando", "about you", "answear", "sportisimo", "decathlon"],
  adidas: ["zalando", "about you", "answear", "sportisimo", "decathlon"],
  sport: ["sportisimo", "decathlon", "intersport", "nike", "adidas"],
  knihy: ["martinus", "panta rhei", "alza"],
  nabytek: ["ikea", "mall", "4home", "obi"],
  nábytok: ["ikea", "mall", "4home", "obi"],
  dom: ["ikea", "mall", "4home", "obi", "hornbach"],
  // Spotrebiče
  "chladnička": ["alza", "mall", "datart", "nay", "okay"],
  "chladnicka": ["alza", "mall", "datart", "nay", "okay"],
  "mraznička": ["alza", "mall", "datart", "okay"],
  "mraznicka": ["alza", "mall", "datart", "okay"],
  "práčka": ["alza", "mall", "datart", "okay"],
  "pracka": ["alza", "mall", "datart", "okay"],
  "rúra": ["alza", "mall", "datart", "okay"],
  "rura": ["alza", "mall", "datart", "okay"],
  "mikrovlnka": ["alza", "mall", "datart"],
  "umývačka": ["alza", "mall", "datart", "okay"],
  "umyvacka": ["alza", "mall", "datart", "okay"],
  // Klimatizácia
  "klimatizácia": ["alza", "mall", "datart"],
  "klimatizacia": ["alza", "mall", "datart"],
  "ventilátor": ["alza", "mall", "datart"],
  "ventilator": ["alza", "mall", "datart"],
  // Zdravie & výživa
  "proteín": ["gymbeam"],
  "protein": ["gymbeam"],
  "vitamín": ["gymbeam"],
  "vitamin": ["gymbeam"],
  "doplnok": ["gymbeam"],
  "kreatín": ["gymbeam"],
  "kreatin": ["gymbeam"],
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

export async function POST(req: Request) {
  const { q } = await req.json();
  if (!q?.trim()) return Response.json({ error: "Chýba dotaz" }, { status: 400 });

  const query = q.trim();
  const hash = createHash("md5").update(query.toLowerCase()).digest("hex");
  // v2: pridané CJ + statické Affial kupóny — nový prefix invaliduje starú cache
  const cacheKey = `search_cache:v2:${hash}`;

  // Redis cache
  try {
    const cached = await redis.get<any>(cacheKey);
    if (cached) return Response.json({ ...cached, fromCache: true });
  } catch {}

  const result: any = {
    query,
    coupons: [],
    letaky: [],
  };

  // Kupóny — rovnaké zdroje ako shop stránka (Dognet + Affial + eHub + CJ + statické Affial)
  try {
    const [dognetAll, affialAll, ehubAll, cjAll] = await Promise.all([
      getCoupons().catch(() => []),
      getAffialCoupons().catch(() => []),
      getEhubCoupons().catch(() => []),
      getCjCoupons().catch(() => []),
    ]);
    const relevantShops = getRelevantShops(query);
    const qLow = query.toLowerCase();

    // CJ a statické Affial kupóny namapované na spoločný tvar (campaign_name/title/code/affiliate_link)
    const cjMapped = cjAll.map((c) => ({
      id: c.id,
      campaign_name: c.advertiserName,
      title: c.description,
      code: c.code,
      affiliate_link: c.link,
      type: 1,
    }));
    const affialShopMap = new Map(AFFIAL_SHOPS.map(s => [s.domain, s.affiliateUrl]));
    const affialStatic = AFFIAL_COUPONS.map((c, i) => ({
      id: `affial-static-${c.domain}-${i}`,
      campaign_name: c.shop,
      title: `${c.discount} zľava`,
      code: c.code,
      affiliate_link: affialShopMap.get(c.domain) ?? `https://${c.domain}`,
      type: 1,
    }));
    const staticAkcie = STATIC_AKCIE.map(a => ({
      id: `akcia-${a.id}`,
      campaign_name: a.shopName,
      title: a.title,
      code: "",
      affiliate_link: a.affiliateUrl,
      type: 4,
    }));

    result.coupons = [...dognetAll, ...affialAll, ...ehubAll, ...cjMapped, ...affialStatic, ...staticAkcie].filter((c: any) => {
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

  // Letáky
  if (isLetakQuery(query)) {
    result.letaky = LETAKY.slice(0, 5).map(l => ({
      slug: l.slug, name: l.name, color: l.color, letter: l.letter,
    }));
  }

  // Cache na 30 dní (2592000s)
  try {
    await redis.set(cacheKey, result, { ex: 2592000 });
  } catch {}

  return Response.json(result);
}
