import { getDb } from "@/lib/db";
import { getSalesCoupons } from "@/lib/dognet";
import { getBiggestPriceDropsByDomain } from "@/lib/heureka/price-history";
import { getProductsByDomain } from "@/lib/heureka/query";
import { getAllKnownShops, getStaticKnownShops, type KnownShop } from "@/lib/all-shops";
import { getShopAffiliateUrl } from "@/lib/shop-affiliate";
import { normalizeShopSlug } from "@/lib/slug";
import {
  getAllArticles,
  saveArticle,
  type Article,
  type SaleProduct,
} from "@/lib/articles";

/**
 * Generátor článkov o výpredajoch (cron /api/cron/check-sales, každých 6h).
 *
 * Zdroj zľavy = OBOJE (odsúhlasené):
 *  - Dognet sale kampane (getSalesCoupons, type 1/3) → doména kandidát + headline %
 *  - cenové poklesy z product_price_history (getBiggestPriceDropsByDomain)
 *
 * Grid produktov: prednostne z cenových poklesov (reálna stará/nová cena);
 * ak ich je málo, doplní feed produkty obchodu (getProductsByDomain) bez preškrtnutej ceny.
 * Článok vznikne len ak má obchod ≥ MIN_PRODUCTS produktov.
 *
 * Poznámka: generátor do Neonu NIČ nezapisuje (len číta) — DB je blízko 512 MB stropu.
 */

const MIN_PRODUCTS = 5;
const MAX_PRODUCTS = 20;
const MAX_CANDIDATE_DOMAINS = 80; // strop na runtime crona (DB dotaz na doménu)

const SK_MONTHS = [
  "január", "február", "marec", "apríl", "máj", "jún",
  "júl", "august", "september", "október", "november", "december",
];

function domainFromCampaign(c: any): string {
  const url = c.campaign?.url ?? c.campaign?.website_url ?? "";
  return String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function pctFromText(txt: string): number | null {
  const m = (txt || "").match(/(\d{1,2})\s*%/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 5 && n <= 90 ? n : null;
}

function couponLink(c: any): string {
  if (typeof c?.affiliate_link === "string" && c.affiliate_link.startsWith("http")) return c.affiliate_link;
  if (typeof c?.url === "string" && c.url.startsWith("http")) return c.url;
  return "";
}

function parsePriceNum(price: string): number | null {
  const m = String(price ?? "").replace(",", ".").match(/[0-9]+\.?[0-9]*/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function currencyForDomain(domain: string): string {
  return /\.cz$/i.test(domain) ? "CZK" : "EUR";
}

interface Candidate {
  domain: string;
  shopName: string;
  discountPct: number | null;
  ctaUrl: string | null; // Dognet tracking link, ak je
}

/** Domény s aktivitou v cenovej histórii za posledných 30 dní. */
async function domainsWithPriceHistory(): Promise<string[]> {
  try {
    const sql = getDb();
    const rows = (await sql`
      SELECT domain
      FROM product_price_history
      WHERE recorded_at >= now() - interval '30 days' AND domain <> ''
      GROUP BY domain
      HAVING count(*) >= 2
      ORDER BY count(*) DESC
      LIMIT ${MAX_CANDIDATE_DOMAINS}
    `) as { domain: string }[];
    return rows.map((r) => r.domain).filter(Boolean);
  } catch {
    return [];
  }
}

async function collectCandidates(): Promise<Candidate[]> {
  const byDomain = new Map<string, Candidate>();

  // 1. Dognet sale kampane
  try {
    const sales = await getSalesCoupons(100);
    for (const c of sales) {
      const domain = domainFromCampaign(c);
      const shopName = c.campaign?.name || "";
      if (!domain || !shopName) continue;
      const pct = pctFromText(c.title || c.name || c.description || "");
      const cta = couponLink(c);
      const existing = byDomain.get(domain);
      if (existing) {
        existing.discountPct = existing.discountPct ?? pct;
        existing.ctaUrl = existing.ctaUrl ?? (cta || null);
      } else {
        byDomain.set(domain, { domain, shopName, discountPct: pct, ctaUrl: cta || null });
      }
    }
  } catch {}

  // 2. Domény s cenovými poklesmi (aj bez Dognet kampane)
  const historyDomains = await domainsWithPriceHistory();
  for (const domain of historyDomains) {
    if (!byDomain.has(domain)) {
      byDomain.set(domain, { domain, shopName: "", discountPct: null, ctaUrl: null });
    }
  }

  return Array.from(byDomain.values()).slice(0, MAX_CANDIDATE_DOMAINS);
}

/** Meno + slug obchodu pre doménu — z known shops, inak odvodené z domény. */
function resolveShop(domain: string, fallbackName: string, shopsByDomain: Map<string, KnownShop>) {
  const known = shopsByDomain.get(domain);
  if (known) return { name: known.name, slug: known.slug };
  const name = fallbackName || domain.replace(/\.(sk|cz|eu|com)$/i, "");
  return { name, slug: normalizeShopSlug(name || domain) };
}

async function buildProducts(domain: string): Promise<{ products: SaleProduct[]; maxDropPct: number }> {
  const currency = currencyForDomain(domain);
  const products: SaleProduct[] = [];
  let maxDropPct = 0;
  const seen = new Set<string>();

  // Prednostne reálne cenové poklesy (stará/nová cena)
  const drops = await getBiggestPriceDropsByDomain(domain, MAX_PRODUCTS).catch(() => []);
  for (const d of drops) {
    const key = d.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    maxDropPct = Math.max(maxDropPct, d.dropPct);
    products.push({
      name: d.name,
      imgUrl: d.imgUrl,
      oldPrice: d.oldPrice,
      newPrice: d.newPrice,
      currency: d.currency || currency,
      affiliateUrl: d.affiliateUrl || d.productUrl,
    });
  }

  // Doplň feed produktmi obchodu (bez preškrtnutej ceny), ak je poklesov málo
  if (products.length < MAX_PRODUCTS) {
    const feed = await getProductsByDomain(domain, MAX_PRODUCTS * 2).catch(() => []);
    for (const p of feed) {
      if (products.length >= MAX_PRODUCTS) break;
      const key = p.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      products.push({
        name: p.name,
        imgUrl: p.img_url || "",
        oldPrice: null,
        newPrice: parsePriceNum(p.price),
        currency: p.currency_code || currency,
        affiliateUrl: p.affiliate_url || p.url,
      });
    }
  }

  return { products, maxDropPct };
}

export interface GenerateResult {
  scannedDomains: number;
  created: string[];
  deactivated: string[];
  timestamp: string;
}

export async function generateSaleArticles(): Promise<GenerateResult> {
  const shops = await getAllKnownShops().catch(() => getStaticKnownShops());
  const shopsByDomain = new Map<string, KnownShop>();
  for (const s of shops) if (s.domain) shopsByDomain.set(s.domain.toLowerCase(), s);

  const candidates = await collectCandidates();

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = `${SK_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const nowIso = now.toISOString();

  const existing = await getAllArticles();
  const existingBySlug = new Map(existing.map((a) => [a.slug, a]));

  const created: string[] = [];
  const generatedSlugs = new Set<string>();

  for (const cand of candidates) {
    const { products, maxDropPct } = await buildProducts(cand.domain);
    if (products.length < MIN_PRODUCTS) continue;

    const { name: shopName, slug: shopSlug } = resolveShop(cand.domain, cand.shopName, shopsByDomain);
    if (!shopSlug) continue;

    const discountPct = maxDropPct >= 5 ? maxDropPct : cand.discountPct ?? null;
    const slug = `${shopSlug}-vypredaj-${ym}`;
    generatedSlugs.add(slug);

    const ctaUrl =
      cand.ctaUrl ||
      (await getShopAffiliateUrl(shopName).catch(() => null)) ||
      `https://${cand.domain}`;

    const image = products.find((p) => p.imgUrl)?.imgUrl;
    const pctLabel = discountPct ? ` – zľavy až -${discountPct}%` : "";
    const title = `${shopName} výpredaj ${monthLabel}${pctLabel}`;
    const perex = discountPct
      ? `Aktuálny výpredaj v obchode ${shopName} – vybrali sme ${products.length} produktov so zľavou až -${discountPct}%. Ceny a dostupnosť over priamo v obchode.`
      : `Aktuálne akciové produkty v obchode ${shopName}. Vybrali sme ${products.length} zaujímavých ponúk – ceny a dostupnosť over priamo v obchode.`;

    const prev = existingBySlug.get(slug);
    const article: Article = {
      slug,
      type: "sale",
      title,
      perex,
      imageUrl: image,
      shopName,
      domain: cand.domain,
      shopSlug,
      discountPct,
      products,
      affiliateUrl: ctaUrl,
      date: prev?.date ?? nowIso, // zachovaj pôvodný publikačný dátum pri update
      updatedAt: nowIso,
      published: true,
      source: prev?.source === "manual" ? "manual" : "auto",
      validTo: null,
    };

    await saveArticle(article);
    created.push(slug);
  }

  // Deaktivuj automatické sale články, ktoré v tomto behu už nekvalifikovali (akcia skončila)
  const deactivated: string[] = [];
  for (const a of existing) {
    if (a.type === "sale" && a.source === "auto" && a.published && !generatedSlugs.has(a.slug)) {
      await saveArticle({ ...a, published: false, updatedAt: nowIso, validTo: nowIso });
      deactivated.push(a.slug);
    }
  }

  return {
    scannedDomains: candidates.length,
    created,
    deactivated,
    timestamp: nowIso,
  };
}
