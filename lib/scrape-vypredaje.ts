import { gotScraping } from "got-scraping";
import { resolveAkciaAffiliateUrls } from "@/lib/shop-affiliate";
import { buildServerHeurekaSearchUrl } from "@/lib/heureka/affiliate";
import { normalizeShopSlug } from "@/lib/slug";
import { getShopDomain } from "@/lib/shop-domains";
import { saveArticle, getAllArticles, type Article } from "@/lib/articles";

/**
 * Scraper výpredajov z vasekupony.sk/vypredaje.
 *
 * Etika/právo: robots.txt povoľuje /vypredaje; extrahujeme len FAKTY
 * (obchod, cieľová URL, zľava %, platnosť) a generujeme VLASTNÝ text — nekopírujeme
 * ich články. Ich affiliate tracker (data-eshop-url) ignorujeme; monetizujeme cez
 * náš affiliate (resolveAkciaAffiliateUrls), a keď ho nemáme, cez Heureku (haff).
 * Spúšťané manuálne z admin panelu (nie automatický masový scraping).
 */

const SOURCE_URL = "https://vasekupony.sk/vypredaje";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const MAX_DEALS = 40;

const SK_MONTHS = [
  "január", "február", "marec", "apríl", "máj", "jún",
  "júl", "august", "september", "október", "november", "december",
];

interface RawDeal {
  domain: string;
  shopName: string;
  shopSlug: string;
  destUrl: string;
  discountPct: number | null;
  validTo: string | null;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function nameFromDomain(domain: string): string {
  const base = domain.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseValidTo(ts?: string): string | null {
  if (!ts) return null;
  const n = parseInt(ts, 10);
  // ts v sekundách; obrovské (rok 9999) = "do odvolania" → bez expirácie.
  // Reálne datované ponuky majú ts ~1.7–1.9e9. Hranica = rok 2100.
  if (!Number.isFinite(n) || n <= 0 || n > 4102444800) return null;
  const d = new Date(n * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Rozparsuje HTML /vypredaje na jednotlivé ponuky (len fakty). */
export function parseVypredajeHtml(html: string): RawDeal[] {
  const segments = html.split('class="row coupon couponData').slice(1);
  const deals: RawDeal[] = [];
  const seen = new Set<string>();

  for (const seg of segments) {
    const head = seg.slice(0, 2600);
    // Cieľový obchod: data-external-url (čistá URL) alebo POSLEDNÝ https:// v ich
    // tracker reťazci (data-eshop-url) — greedy [^"]* necháva posledný odkaz.
    const destUrl = head.match(/data-external-url="([^"]+)"/)?.[1]
      ?? head.match(/data-eshop-url="[^"]*(https?:\/\/[^"]+)"/)?.[1]
      ?? "";
    if (!destUrl || !/^https?:\/\//.test(destUrl)) continue;

    const domain = domainFromUrl(destUrl);
    if (!domain || seen.has(domain)) continue;

    const titleText = head.match(/discountClick[^>]*>\s*([^<]+)</)?.[1] ?? "";
    const pctM = titleText.match(/(\d{1,2})\s*%/) ?? head.match(/>\s*[^<]*?(\d{1,2})\s*%/);
    const discountPct = pctM ? parseInt(pctM[1], 10) : null;

    const validTo = parseValidTo(head.match(/data-timestamp="(\d+)"/)?.[1]);

    const vkSlug = head.match(/href="\/kupony\/([^"]+)"/)?.[1];
    const shopName = nameFromDomain(domain);
    const shopSlug = normalizeShopSlug(shopName) || (vkSlug ? normalizeShopSlug(vkSlug) : "");
    if (!shopSlug) continue;

    seen.add(domain);
    deals.push({
      domain, shopName, shopSlug, destUrl,
      discountPct: discountPct && discountPct >= 5 && discountPct <= 90 ? discountPct : null,
      validTo,
    });
    if (deals.length >= MAX_DEALS) break;
  }

  return deals;
}

function buildContent(shopName: string, pct: number | null, validTo: string | null): { perex: string; content: string } {
  const pctTxt = pct ? ` so zľavami až -${pct}%` : "";
  const validTxt = validTo
    ? `Akcia platí do ${new Date(validTo).toLocaleDateString("sk-SK")}.`
    : "Ide o priebežnú akciu bez uvedeného dátumu ukončenia.";
  const perex = `Aktuálny výpredaj v obchode ${shopName}${pctTxt}. ${validTxt} Ceny a dostupnosť over priamo v obchode.`;
  const content =
    `<p>V obchode <strong>${shopName}</strong> práve prebieha výpredaj${pctTxt}. ${validTxt}</p>` +
    `<p>Vo výpredajovej ponuke sa oplatí sledovať zlacnené kúsky z aktuálnej aj predošlej sezóny — často ide o rovnaký tovar za nižšiu cenu. Pred nákupom si over aktuálne ceny a dostupnosť priamo v obchode.</p>` +
    `<h2>Čo sa oplatí sledovať</h2><ul>` +
    `<li>Najväčšie zľavy na dopredaj skladových zásob</li>` +
    `<li>Akciové balíčky a sety</li>` +
    `<li>Dostupné kupóny pre ${shopName} (nižšie)</li></ul>` +
    `<p>Ceny a podmienky akcie sa môžu meniť — vždy si ich over priamo v obchode.</p>`;
  return { perex, content };
}

export interface ScrapeResult {
  fetched: number;   // koľko ponúk sme rozparsovali
  created: number;   // koľko článkov vzniklo/aktualizovalo sa
  monetizedAffiliate: number;
  monetizedHeureka: number;
  slugs: string[];
  timestamp: string;
}

/** Stiahne, rozparsuje a uloží články z výpredajov vasekupony.sk. */
export async function importScrapedVypredaje(): Promise<ScrapeResult> {
  // Cloudflare blokuje Node/undici fetch podľa TLS fingerprintu → gotScraping
  // napodobní prehliadačový TLS/HTTP2 odtlačok a hlavičky.
  const res = await gotScraping({
    url: SOURCE_URL,
    headers: { "User-Agent": UA, "Accept-Language": "sk-SK,sk;q=0.9,cs;q=0.8,en;q=0.7" },
    timeout: { request: 25000 },
    retry: { limit: 1 },
  });
  if (res.statusCode !== 200) throw new Error(`vasekupony.sk vrátil HTTP ${res.statusCode}`);
  const html = res.body;

  const deals = parseVypredajeHtml(html);
  if (deals.length === 0) throw new Error("Nepodarilo sa rozparsovať žiadnu ponuku (zmena štruktúry?)");

  // Batch resolve affiliate (Dognet/eHub/Affial) — jeden fetch každého zdroja.
  const resolved = await resolveAkciaAffiliateUrls(
    deals.map((d) => ({ shopName: d.shopName, domain: d.domain, affiliateUrl: "" }))
  );

  const now = new Date();
  const monthLabel = `${SK_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const nowIso = now.toISOString();

  const existing = await getAllArticles().catch(() => [] as Article[]);
  const existingBySlug = new Map(existing.map((a) => [a.slug, a]));

  let monetizedAffiliate = 0;
  let monetizedHeureka = 0;
  const slugs: string[] = [];

  for (let i = 0; i < deals.length; i++) {
    const d = deals[i];
    const affiliate = resolved[i]?.affiliateUrl?.startsWith("http") ? resolved[i].affiliateUrl : "";
    const ctaUrl = affiliate || buildServerHeurekaSearchUrl(d.shopName);
    if (affiliate) monetizedAffiliate++; else monetizedHeureka++;

    const { perex, content } = buildContent(d.shopName, d.discountPct, d.validTo);
    const slug = `${d.shopSlug}-vypredaj`;
    const prev = existingBySlug.get(slug);
    const pctLabel = d.discountPct ? ` – zľavy až -${d.discountPct}%` : "";

    const article: Article = {
      slug,
      type: "sale",
      title: `${d.shopName} výpredaj ${monthLabel}${pctLabel}`,
      perex,
      content,
      shopName: d.shopName,
      domain: d.domain,
      shopSlug: d.shopSlug,
      discountPct: d.discountPct,
      products: [],
      affiliateUrl: ctaUrl,
      date: prev?.date ?? nowIso,
      updatedAt: nowIso,
      published: true,
      source: "auto",
      validTo: d.validTo,
    };
    await saveArticle(article);
    slugs.push(slug);
  }

  return {
    fetched: deals.length,
    created: slugs.length,
    monetizedAffiliate,
    monetizedHeureka,
    slugs,
    timestamp: nowIso,
  };
}
