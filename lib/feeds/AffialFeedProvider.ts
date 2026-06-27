import { XMLParser } from "fast-xml-parser";
import { redis } from "@/lib/redis";

const CACHE_TTL = 21600;

export interface FeedProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  domain: string;
  affiliateUrl: string;
  category: string;
}

const AFFILIATE_LINKS: Record<string, string> = {
  "kosmetikomat.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=7f1e0945",
  "spaceylon.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=8dd268c9",
  "e-matrac.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=7333ef8f",
  "enemiq.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=0fd905ea",
  "shox.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=bf2d48e7",
  "auto123.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=d7c0bd56",
  "happylu.cz": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=78943379",
  "togga.cz": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=6c0959fa",
  "blendea.sk": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=845b3845",
  "blendea.cz": "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=845b3845",
  "superstrava.sk": "https://www.superstrava.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=02bd6c6c",
  "altevita.sk": "https://altevita.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=8bbcdb52",
  "arno-obuv.sk": "https://www.arno-obuv.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=e6456574",
};

export const FEEDS = [
  // zdravie
  { url: "https://greenmedical.venalio.com/feeds/heureka?websiteLanguageId=1&secretKey=gfcqk793m9iifpodwnssfh9s7sdnfqryy2zshrfw", domain: "namaximum.sk", category: "zdravie" },
  { url: "https://www.superstrava.sk/heureka/export/products.xml", domain: "superstrava.sk", category: "zdravie" },
  { url: "https://www.altevita.sk/heureka/export/products.xml", domain: "altevita.sk", category: "zdravie" },
  { url: "https://powerlogy.com/wp-content/uploads/wpallexport/exports/55f587f59fd8330d834ce3dc733b6c31/current-CRON-heureka-xml-feed.xml", domain: "powerlogy.com", category: "zdravie" },
  { url: "https://www.bionutrian.com/wp-content/uploads/xml/heureka_1.xml", domain: "bionutrian.com", category: "zdravie" },
  { url: "https://www.ajala.cz/heureka/export/products.xml", domain: "ajala.cz", category: "zdravie" },
  { url: "https://www.neurinu.cz/wp-content/uploads/xml/heureka_1.xml", domain: "neurinu.cz", category: "zdravie" },
  { url: "https://www.organicmarket.cz/heureka/export/products.xml", domain: "organicmarket.cz", category: "zdravie" },
  { url: "https://www.zdravibezchemie.cz/heureka/export/products.xml", domain: "zdravibezchemie.cz", category: "zdravie" },
  { url: "https://www.blendea.cz/google/export/products.xml?hash=GtthfasBtRIRsl8yiPRuCn8A", domain: "blendea.cz", category: "zdravie" },
  { url: "https://www.chiashake.sk/feed-heureka-2lkmu0rfo9.xml", domain: "chiashake.sk", category: "zdravie" },
  { url: "https://www.mixslim.sk/feed-heureka-2lkmu0rfo9.xml", domain: "mixslim.sk", category: "zdravie" },
  // krása
  { url: "https://www.kosmetikomat.sk/google.xml?hash=M2iNmNTwx981bVRSOfCjF5uo", domain: "kosmetikomat.sk", category: "krasa" },
  { url: "https://www.kosmetikomat.cz/heureka/export/products.xml", domain: "kosmetikomat.cz", category: "krasa" },
  { url: "https://www.spaceylon.sk/fotky44397/xml/heureka_sk.xml", domain: "spaceylon.sk", category: "krasa" },
  { url: "https://nechtovyraj.sk/data-xml/modul-google/google-read.php?shop=1&type=products&lang=sk&token=6e79e0d3a4", domain: "nechtovyraj.sk", category: "krasa" },
  // bývanie
  { url: "https://www.e-matrac.sk/heureka/export/products.xml", domain: "e-matrac.sk", category: "byvanie" },
  { url: "https://www.fotoobrazyzplatna.cz/export/heureka.xml?lang=sk", domain: "fotoobrazyzplatna.sk", category: "byvanie" },
  { url: "https://www.sedet.cz/export/heureka/feed.xml", domain: "sedet.cz", category: "byvanie" },
  { url: "https://www.artofhome.cz/google/export/products.xml", domain: "artofhome.cz", category: "byvanie" },
  { url: "https://exports.conviu.com/open/17ppwlo1bht7ip5264rjxvoax831mpgo/writer/hoia0kfbny75kojk3qxpdv9rck6g7gs6.xml", domain: "li-go.cz", category: "byvanie" },
  // móda
  { url: "https://www.arno-obuv.sk/feed/heureka", domain: "arno-obuv.sk", category: "moda" },
  { url: "https://www.enemiq.sk/heureka/export/products.xml", domain: "enemiq.sk", category: "moda" },
  { url: "https://www.enemiq.cz/heureka/export/products.xml", domain: "enemiq.cz", category: "moda" },
  { url: "https://www.irisimo.sk/export/heureka", domain: "irisimo.sk", category: "moda" },
  { url: "https://www.irisimo.cz/export/heureka", domain: "irisimo.cz", category: "moda" },
  // deti
  { url: "https://www.dadaboom.sk/feed-heureka-tl7hkzvm56.xml", domain: "dadaboom.sk", category: "deti" },
  { url: "https://www.kojenecke-obleceni.eu/export/heureka/472b02a8-25a0-4294-bec4-055a24411fd3", domain: "kojenecke-obleceni.eu", category: "deti" },
  { url: "https://feeds.mergado.com/elektricka-auticka-heureka-cz-cz-1-1ab00de3fd9779709cc451d089fbd3b0.xml", domain: "elektrickeauticko.cz", category: "deti" },
  // šport
  { url: "https://www.shox.sk/wp-content/uploads/product-feeds/heureka_sk.xml", domain: "shox.sk", category: "sport" },
  { url: "https://www.shox.cz/wp-content/uploads/product-feeds/heureka_cz.xml", domain: "shox.cz", category: "sport" },
  { url: "https://www.belda.sk/heureka/export/products.xml", domain: "belda.sk", category: "sport" },
  { url: "https://www.beldasport.cz/heureka/export/products.xml", domain: "beldasport.cz", category: "sport" },
  // iné
  { url: "https://www.togga.cz/heureka/export/products.xml", domain: "togga.cz", category: "ine" },
  { url: "https://www.happylu.cz/heureka/export/products.xml", domain: "happylu.cz", category: "ine" },
  { url: "https://drinkcentrum.sk/heureka_sk.xml", domain: "drinkcentrum.sk", category: "ine" },
  { url: "https://auto123.sk/media/feeds/heureka.xml", domain: "auto123.sk", category: "ine" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseXML(xml: string, domain: string, category: string): FeedProduct[] {
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  // Heureka format: <SHOP><SHOPITEM>...</SHOPITEM></SHOP>
  const shopRoot = parsed?.SHOP ?? parsed?.shop ?? parsed;
  const rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;

  if (rawItems) {
    const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    return items
      .filter((item: any) => item && typeof item === "object")
      .slice(0, 500)
      .map((item: any): FeedProduct => ({
        name: String(item.PRODUCTNAME ?? item.NAME ?? item.productname ?? "").trim(),
        description: stripHtml(String(item.DESCRIPTION ?? item.description ?? "")).slice(0, 200),
        price: String(item.PRICE_VAT ?? item.PRICE ?? item.price ?? "").trim(),
        url: String(item.URL ?? item.url ?? "").trim(),
        imgUrl: String(item.IMGURL ?? item.IMAGE_MAIN ?? item.IMGURL_ALTERNATIVE ?? item.imgurl ?? "").trim(),
        domain,
        affiliateUrl: AFFILIATE_LINKS[domain] ?? String(item.URL ?? item.url ?? "").trim(),
        category,
      }))
      .filter((p) => p.name && p.url);
  }

  // RSS / Google Shopping format: <rss><channel><item>
  const channelItems = parsed?.rss?.channel?.item;
  if (channelItems) {
    const items: any[] = Array.isArray(channelItems) ? channelItems : [channelItems];
    return items
      .filter((item: any) => item && typeof item === "object")
      .slice(0, 500)
      .map((item: any): FeedProduct => ({
        name: String(item.title ?? item["g:title"] ?? "").trim(),
        description: stripHtml(String(item.description ?? item["g:description"] ?? "")).slice(0, 200),
        price: String(item["g:price"] ?? item.price ?? "").trim(),
        url: String(item.link ?? item["g:link"] ?? "").trim(),
        imgUrl: String(item["g:image_link"] ?? item["g:image"] ?? "").trim(),
        domain,
        affiliateUrl: AFFILIATE_LINKS[domain] ?? String(item.link ?? item["g:link"] ?? "").trim(),
        category,
      }))
      .filter((p) => p.name && p.url);
  }

  return [];
}

async function fetchAndCacheFeed(url: string, domain: string, category: string): Promise<FeedProduct[]> {
  const cacheKey = `feed:${domain}`;

  try {
    const cached = await redis.get<FeedProduct[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Zlavickovo/1.0; +https://zlavickovo.sk)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const products = parseXML(xml, domain, category);
    if (products.length > 0) {
      try {
        await redis.set(cacheKey, products, { ex: CACHE_TTL });
      } catch {}
    }
    return products;
  } catch {
    return [];
  }
}

export async function importAllAffialFeeds(): Promise<{ count: number; feeds: number }> {
  const allFeeds = [...FEEDS];
  try {
    const custom = await redis.get<{ url: string; domain: string; category: string }[]>("affial:feed_urls");
    if (custom && Array.isArray(custom)) allFeeds.push(...custom);
  } catch {}

  const counts = await Promise.all(
    allFeeds.map(async (f) => {
      const products = await fetchAndCacheFeed(f.url, f.domain, f.category);
      if (products.length > 0) {
        try { await redis.sadd("affial:feed_domains", f.domain); } catch {}
      }
      return products.length;
    })
  );
  return { count: counts.reduce((a, b) => a + b, 0), feeds: allFeeds.length };
}

export async function getAffialProductCount(): Promise<number> {
  try {
    const domains = await redis.smembers("affial:feed_domains") as string[];
    const counts = await Promise.all(
      domains.map(async (d) => {
        const p = await redis.get<any[]>(`feed:${d}`);
        return p?.length ?? 0;
      })
    );
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

export async function searchProducts(query: string): Promise<FeedProduct[]> {
  const lq = query.toLowerCase().trim();
  if (!lq) return [];

  const perFeedResults = await Promise.all(
    FEEDS.map((feed) =>
      fetchAndCacheFeed(feed.url, feed.domain, feed.category).then((products) =>
        products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(lq) ||
              p.description.toLowerCase().includes(lq)
          )
          .slice(0, 3)
      )
    )
  );

  return perFeedResults.flat().slice(0, 20);
}
