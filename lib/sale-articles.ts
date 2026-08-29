import { getSalesCoupons } from "@/lib/dognet";
import { getAllKnownShops, getStaticKnownShops, type KnownShop } from "@/lib/all-shops";
import { getShopAffiliateUrl } from "@/lib/shop-affiliate";
import { normalizeShopSlug } from "@/lib/slug";
import { getAffiliateActions } from "@/lib/affiliate-actions";
import {
  actionContentHash,
  buildAffiliateActionPerex,
  buildSaleSeoContent,
} from "@/lib/article-seo";
import {
  getAllArticles,
  saveArticle,
  type Article,
  type SaleProduct,
} from "@/lib/articles";
import { resolveActionImage } from "@/lib/action-image";

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
const MAX_CANDIDATE_DOMAINS = 80; // strop na runtime crona
const IMAGE_BUDGET = 40; // max. koľko reálnych obrázkov doťaháme za jeden beh crona

const SK_MONTHS = [
  "január", "február", "marec", "apríl", "máj", "jún",
  "júl", "august", "september", "október", "november", "december",
];

interface SaleCouponCandidate {
  title?: string;
  name?: string;
  description?: string;
  affiliate_link?: string;
  url?: string;
  campaign?: { name?: string; url?: string; website_url?: string };
}

function domainFromCampaign(c: SaleCouponCandidate): string {
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

function couponLink(c: SaleCouponCandidate): string {
  if (typeof c?.affiliate_link === "string" && c.affiliate_link.startsWith("http")) return c.affiliate_link;
  if (typeof c?.url === "string" && c.url.startsWith("http")) return c.url;
  return "";
}

interface Candidate {
  domain: string;
  shopName: string;
  discountPct: number | null;
  ctaUrl: string | null; // Dognet tracking link, ak je
}

/** Domény s aktivitou v cenovej histórii za posledných 30 dní. */
async function domainsWithPriceHistory(): Promise<string[]> {
  // Cenová história (product_price_history) je odstránená; kandidáti na sale
  // články vychádzajú výhradne z Dognet sale kampaní.
  return [];
}

async function collectCandidates(): Promise<Candidate[]> {
  const byDomain = new Map<string, Candidate>();

  // 1. Dognet sale kampane
  try {
    const sales = await getSalesCoupons(100) as SaleCouponCandidate[];
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

async function buildProducts(_domain: string): Promise<{ products: SaleProduct[]; maxDropPct: number }> {
  // Produktový grid a cenové poklesy sú odstránené (žiadny produktový katalóg,
  // žiadna Heureka). Sale články sú textové o výpredaji obchodu; /akcie ako
  // živý deal listing sa prepracuje vo fáze B4.
  return { products: [], maxDropPct: 0 };
}

export interface GenerateResult {
  scannedDomains: number;
  scannedActions: number;
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
  const generatedActionSlugs = new Set<string>();

  // Každá aktuálna affiliate akcia dostane vlastný stabilný detail a SEO obsah.
  const affiliateActions = await getAffiliateActions().catch(() => []);
  let imageBudget = IMAGE_BUDGET;
  for (const action of affiliateActions) {
    const prev = existingBySlug.get(action.articleSlug);
    const contentHash = actionContentHash(action);
    generatedActionSlugs.add(action.articleSlug);

    // Reálny obrázok akcie (banner inzerenta → feed → og:image). Ťaháme len keď
    // ho ešte nemáme a v rámci rozpočtu behu; výsledok je v Redise cachovaný.
    let imageUrl = prev?.imageUrl;
    let imageSource = prev?.imageSource;
    if (!imageUrl && imageBudget > 0) {
      imageBudget--;
      const resolved = await resolveActionImage({
        shopName: action.shopName,
        domain: action.domain,
      }).catch(() => null);
      if (resolved) {
        imageUrl = resolved.url;
        imageSource = resolved.source;
      }
    }

    // Nehýb updatedAt ani sitemap lastmod, pokiaľ sa nezmenili vstupné dáta akcie
    // ani sa nedoplnil nový obrázok.
    if (prev?.contentHash === contentHash && prev.published && imageUrl === prev?.imageUrl) continue;

    const article: Article = {
      slug: action.articleSlug,
      type: "sale",
      title: action.title.toLocaleLowerCase("sk").includes(action.shopName.toLocaleLowerCase("sk"))
        ? action.title
        : `${action.shopName}: ${action.title}`,
      perex: buildAffiliateActionPerex(action),
      shopName: action.shopName,
      domain: action.domain,
      shopSlug: action.shopSlug,
      discountPct: action.discountPct,
      products: prev?.products || [],
      imageUrl,
      imageSource,
      affiliateUrl: action.affiliateUrl,
      date: prev?.date ?? nowIso,
      updatedAt: nowIso,
      published: true,
      source: "auto",
      validTo: action.validTo,
      actionKey: action.actionKey,
      origin: "affiliate-action",
      contentHash,
    };
    article.content = buildSaleSeoContent(article);
    await saveArticle(article);
    created.push(article.slug);
  }

  for (const cand of candidates) {
    const { products, maxDropPct } = await buildProducts(cand.domain);
    if (products.length < MIN_PRODUCTS) continue;

    const { name: shopName, slug: shopSlug } = resolveShop(cand.domain, cand.shopName, shopsByDomain);
    if (!shopSlug) continue;

    // Monetizácia: článok vytvor len ak vieme získať REÁLNY affiliate link
    // (Dognet tracking z kupónu alebo joined program). Bez neho obchod preskoč —
    // nechceme písať články pre obchody, na ktoré nemáme affiliate.
    const ctaUrl = cand.ctaUrl || (await getShopAffiliateUrl(shopName).catch(() => null));
    if (!ctaUrl) continue;

    const discountPct = maxDropPct >= 5 ? maxDropPct : cand.discountPct ?? null;
    const slug = `${shopSlug}-vypredaj-${ym}`;
    generatedSlugs.add(slug);

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
      imageSource: image ? "feed" : undefined,
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
      origin: "price-drop",
    };
    article.content = prev?.source === "manual" && prev.content
      ? prev.content
      : buildSaleSeoContent(article);

    await saveArticle(article);
    created.push(slug);
  }

  // Každý automat deaktivuje iba vlastné články; nezasiahne scrapované ani ručné.
  const deactivated: string[] = [];
  for (const a of existing) {
    const missingAffiliateAction = a.origin === "affiliate-action" && !generatedActionSlugs.has(a.slug);
    const missingPriceDrop = a.origin === "price-drop" && !generatedSlugs.has(a.slug);
    if (a.type === "sale" && a.source === "auto" && a.published && (missingAffiliateAction || missingPriceDrop)) {
      await saveArticle({ ...a, published: false, updatedAt: nowIso, validTo: nowIso });
      deactivated.push(a.slug);
    }
  }

  return {
    scannedDomains: candidates.length,
    scannedActions: affiliateActions.length,
    created,
    deactivated,
    timestamp: nowIso,
  };
}
