/**
 * CJ Product Feed — read-only discovery a audit (Fáza CJ-1).
 *
 * Zdroj produktových dát publishera je CJ **Product Feed GraphQL API**:
 *   Endpoint: https://ads.api.cj.com/query
 *   Auth:     Authorization: Bearer <Personal Access Token (PAT)>
 *   Argument: companyId (~7 číslic)
 *   Query:    shoppingProductFeeds (metadata katalógov v sieti — cold discovery),
 *             products (reálne produkty IBA od joined advertiserov)
 *   Pagination: maxResults (1..1000) + offset
 *
 * POZOR — rozsah Fázy CJ-1:
 *   - IBA discovery + audit. Nič sa neimportuje do DB, nevytvára sa cj_products,
 *     nemení sa vyhľadávanie ani getBestPurchase.
 *   - Modul NEZAPISUJE do DB ani Redis. Joined cross-check číta iba read-only cache
 *     (lib/cj.ts getJoinedCjAdvertiserIds).
 *   - Tracking API (createOrders/restateOrders/cancelOrders) sa NEVOLÁ — mimo scope.
 *
 * POZNÁMKA k schéme: presné názvy polí v CJ GraphQL schéme sa môžu líšiť podľa
 * verzie. GraphQL query stringy nižšie sú centralizované konštanty; parsovanie
 * odpovede je zámerne defenzívne (číta viac možných kľúčov). Ak sa schéma zmení,
 * upravuje sa iba tu — endpoint vráti bezpečný 502 s GraphQL chybou (bez tokenu).
 */

// ── Konštanty rozsahu / limity ──────────────────────────────────────────────
export const CJ_GRAPHQL_ENDPOINT = "https://ads.api.cj.com/query";
export const MAX_PRODUCTS_PER_FEED = 25;
export const MAX_PRODUCTS_PER_REQUEST = 1000;
export const DEFAULT_TIMEOUT_MS = 15000;

export const SUPPORTED_CURRENCIES = new Set(["EUR", "CZK"]);
export const SUPPORTED_MARKETS = new Set(["SK", "CZ"]);

// Klasifikačné prahy (%). Data-driven — nie podľa názvu advertisera.
const PRICE_MIN = 90;      // % položiek s cenou > 0
const DEEPLINK_MIN = 90;   // % položiek s produktovým odkazom
const CURRENCY_MIN = 80;   // % položiek v EUR/CZK
const EAN_MIN = 60;        // % položiek s validným EAN/GTIN pre porovnanie cien
const CONDITION_MIN = 80;  // % položiek s condition poľom
const FIXED_MIN = 80;      // % položiek s pevnou cenou (nie aukcia)

// Import capy podľa triedy (koľko produktov by sa smelo importovať neskôr).
const CAP_ELIGIBLE = 20000;
const CAP_LOW_IDENTITY = 5000; // len do vyhľadávania, nie do porovnania cien

// ── Typy ────────────────────────────────────────────────────────────────────
export type FeedClassification =
  | "ELIGIBLE_PRODUCT_FEED"
  | "MARKETPLACE_RESTRICTED"
  | "LOW_IDENTITY"
  | "UNSUPPORTED_MARKET"
  | "INVALID_OR_EMPTY";

export interface CjFeedMeta {
  advertiserId: string;
  advertiserName: string;
  feedId: string;
  feedName: string;
  market: string;   // ISO krajina (SK/CZ/...)
  currency: string; // EUR/CZK/...
  language: string;
  estimatedProductCount: number | null;
  lastUpdated: string | null;
  availableFields: string[];
}

export interface NormalizedProduct {
  title?: string;
  priceAmount?: number;
  currency?: string;
  ean?: string;
  brand?: string;
  link?: string;         // produktový odkaz (destination / advertiser link)
  imageLink?: string;
  availability?: string;
  condition?: string;
  saleType?: string;     // "auction" / "fixed" ak feed poskytuje
}

export interface FeedMetrics {
  sampleSize: number;
  validEanPercent: number;
  positivePricePercent: number;
  eurOrCzkPercent: number;
  inStockPercent: number;
  deepLinkPercent: number;
  imagePercent: number;
  brandPercent: number;
  conditionFieldPercent: number;
  fixedPriceFieldPercent: number;
  encodingProblemPercent: number;
}

export interface SampleProduct {
  title: string;
  priceAmount: number | null;
  currency: string | null;
  hasEan: boolean;
  hasDeepLink: boolean;
  brand: string | null;
  availability: string | null;
  condition: string | null;
}

export interface FeedReport {
  advertiserId: string;
  advertiserName: string;
  feedId: string;
  feedName: string;
  market: string;
  currency: string;
  estimatedProductCount: number | null;
  sampleSize: number;
  metrics: FeedMetrics;
  classification: FeedClassification;
  blockers: string[];
  recommendedImportCap: number;
  sampleProducts: SampleProduct[];
}

export interface DiscoveryResult {
  ok: boolean;
  totalAdvertisers: number;
  totalFeeds: number;
  totalSampledProducts: number;
  hasMore: boolean;
  checkpoint: number | null;
  feeds: FeedReport[];
}

export type FetchImpl = typeof fetch;

export class CjApiError extends Error {
  constructor(
    message: string,
    public kind: "network" | "auth" | "graphql" | "http"
  ) {
    super(message);
    this.name = "CjApiError";
  }
}

// ── Credentials ──────────────────────────────────────────────────────────────
export interface CjProductCredentials {
  token: string;
  companyId: string;
}

/**
 * Číta nové env pre Product Feed API. NIE je to CJ_API_KEY/CJ_WEBSITE_ID
 * (tie patria staršiemu Link Search XML API a nesmú sa tu použiť).
 */
export function getCjProductCredentials(
  env: NodeJS.ProcessEnv = process.env
): CjProductCredentials | null {
  const token = env.CJ_PERSONAL_ACCESS_TOKEN;
  const companyId = env.CJ_COMPANY_ID;
  if (!token || !companyId) return null;
  return { token, companyId };
}

// ── GraphQL vrstva ───────────────────────────────────────────────────────────
const FEEDS_QUERY = `
query CjProductFeedDiscovery($companyId: ID!) {
  shoppingProductFeeds(companyId: $companyId) {
    resultList {
      advertiserId
      advertiserName
      feedName
      feedLanguage
      feedCurrency
      feedTargetCountry
      feedProductCount
      feedLastUpdated
    }
  }
}`.trim();

const PRODUCTS_QUERY = `
query CjProductSample($companyId: ID!, $advertiserIds: [ID!], $maxResults: Int!, $offset: Int!) {
  products(companyId: $companyId, advertiserIds: $advertiserIds, maxResults: $maxResults, offset: $offset) {
    totalCount
    resultList {
      advertiserId
      advertiserName
      title
      price
      salePrice
      currency
      gtin
      brand
      link
      imageLink
      availability
      condition
      saleType
    }
  }
}`.trim();

interface GraphqlDeps {
  token: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
}

/**
 * Jedno GraphQL volanie. NIKDY neloguje ani nevracia token. Chyby mapuje na
 * CjApiError s kind pre bezpečné HTTP kódy (auth→502, network→502, graphql→502).
 */
async function cjGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  deps: GraphqlDeps
): Promise<T> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(CJ_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${deps.token}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new CjApiError("CJ GraphQL network error", "network");
  }

  if (res.status === 401 || res.status === 403) {
    throw new CjApiError("CJ GraphQL auth rejected", "auth");
  }
  if (!res.ok) {
    throw new CjApiError(`CJ GraphQL HTTP ${res.status}`, "http");
  }

  let json: { data?: T; errors?: Array<{ message?: string }> };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new CjApiError("CJ GraphQL invalid JSON", "graphql");
  }

  if (json.errors && json.errors.length > 0) {
    // Bezpečná, nezradná správa — bez tokenu.
    const first = json.errors[0]?.message ?? "unknown";
    const looksAuth = /auth|token|unauthor|forbidden|permission/i.test(first);
    throw new CjApiError(
      `CJ GraphQL error: ${first.slice(0, 200)}`,
      looksAuth ? "auth" : "graphql"
    );
  }
  if (!json.data) throw new CjApiError("CJ GraphQL empty data", "graphql");
  return json.data;
}

// ── Defenzívne parsovanie odpovedí ───────────────────────────────────────────
function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.resultList)) return o.resultList;
    if (Array.isArray(o.records)) return o.records;
  }
  return [];
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
}

function parseFeedMeta(raw: unknown): CjFeedMeta {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const availableFields = Object.keys(o);
  const countRaw = pick(o, ["feedProductCount", "productCount", "count"]);
  const count = countRaw === undefined ? null : Number(countRaw);
  return {
    advertiserId: str(pick(o, ["advertiserId", "advertiser-id"])),
    advertiserName: str(pick(o, ["advertiserName", "advertiser-name"])),
    feedId: str(pick(o, ["feedId", "feed-id", "id", "feedName"])),
    feedName: str(pick(o, ["feedName", "feed-name", "name"])),
    market: str(pick(o, ["feedTargetCountry", "targetCountry", "country"])).toUpperCase(),
    currency: str(pick(o, ["feedCurrency", "currency"])).toUpperCase(),
    language: str(pick(o, ["feedLanguage", "language"])).toLowerCase(),
    estimatedProductCount: count !== null && Number.isFinite(count) ? count : null,
    lastUpdated: str(pick(o, ["feedLastUpdated", "lastUpdated"])) || null,
    availableFields,
  };
}

// cena môže byť number | "19.99" | { amount, currency }
function parsePrice(v: unknown): { amount?: number; currency?: string } {
  if (v === null || v === undefined) return {};
  if (typeof v === "number") return Number.isFinite(v) ? { amount: v } : {};
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? { amount: n } : {};
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const a = pick(o, ["amount", "value", "price"]);
    const c = pick(o, ["currency", "currencyCode"]);
    const n = a === undefined ? NaN : Number(a);
    return {
      amount: Number.isFinite(n) ? n : undefined,
      currency: c ? str(c).toUpperCase() : undefined,
    };
  }
  return {};
}

export function normalizeProduct(raw: unknown): NormalizedProduct {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const price = parsePrice(pick(o, ["price", "currentPrice"]));
  const sale = parsePrice(pick(o, ["salePrice", "sale-price"]));
  const currency =
    str(pick(o, ["currency", "currencyCode"])).toUpperCase() ||
    price.currency ||
    sale.currency;
  return {
    title: str(pick(o, ["title", "productName", "name"])) || undefined,
    priceAmount: sale.amount ?? price.amount,
    currency: currency || undefined,
    ean: str(pick(o, ["gtin", "ean", "gtin13", "upc"])) || undefined,
    brand: str(pick(o, ["brand", "manufacturer"])) || undefined,
    link: str(pick(o, ["link", "clickUrl", "buyUrl", "url"])) || undefined,
    imageLink: str(pick(o, ["imageLink", "image", "imageUrl"])) || undefined,
    availability: str(pick(o, ["availability", "stockStatus"])) || undefined,
    condition: str(pick(o, ["condition"])) || undefined,
    saleType: str(pick(o, ["saleType", "listingType", "priceType"])) || undefined,
  };
}

// ── Metriky ──────────────────────────────────────────────────────────────────
const EAN_RE = /^\d{8}$|^\d{12,14}$/;
const ENCODING_RE = /�|Ã.|Å.|â€|Â[^\s]/; // replacement char + časté mojibake

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function isInStock(av?: string): boolean {
  if (!av) return false;
  return /in.?stock|instock|available|skladom|dostupné|yes|true|1/i.test(av);
}

function isNewCondition(c?: string): boolean {
  if (!c) return true; // katalóg bez condition ⇒ predpoklad nový tovar
  return /new|nov/i.test(c);
}

function isAuction(p: NormalizedProduct): boolean {
  const st = p.saleType ?? "";
  return /auction|bid|aukc|aukce/i.test(st);
}

export function computeFeedMetrics(products: NormalizedProduct[]): FeedMetrics {
  const n = products.length;
  let ean = 0, price = 0, cur = 0, stock = 0, deep = 0, img = 0, brand = 0,
    cond = 0, fixed = 0, enc = 0;

  for (const p of products) {
    if (p.ean && EAN_RE.test(p.ean)) ean++;
    if (typeof p.priceAmount === "number" && p.priceAmount > 0) price++;
    if (p.currency && SUPPORTED_CURRENCIES.has(p.currency)) cur++;
    if (isInStock(p.availability)) stock++;
    if (p.link && /^https?:\/\//i.test(p.link)) deep++;
    if (p.imageLink && /^https?:\/\//i.test(p.imageLink)) img++;
    if (p.brand) brand++;
    if (p.condition) cond++;
    if (typeof p.priceAmount === "number" && p.priceAmount > 0 && !isAuction(p)) fixed++;
    if ((p.title && ENCODING_RE.test(p.title)) || (p.brand && ENCODING_RE.test(p.brand))) enc++;
  }

  return {
    sampleSize: n,
    validEanPercent: pct(ean, n),
    positivePricePercent: pct(price, n),
    eurOrCzkPercent: pct(cur, n),
    inStockPercent: pct(stock, n),
    deepLinkPercent: pct(deep, n),
    imagePercent: pct(img, n),
    brandPercent: pct(brand, n),
    conditionFieldPercent: pct(cond, n),
    fixedPriceFieldPercent: pct(fixed, n),
    encodingProblemPercent: pct(enc, n),
  };
}

// ── Klasifikácia ─────────────────────────────────────────────────────────────
const MARKETPLACE_NAME_RE =
  /aukro|marketplace|market.?place|bazar|bazoš|bazos|aukce|aukcia|second.?hand|použit/i;

function isMarketplaceName(meta: CjFeedMeta): boolean {
  return MARKETPLACE_NAME_RE.test(`${meta.advertiserName} ${meta.feedName}`);
}

function isSupportedMarket(meta: CjFeedMeta): boolean {
  // Trh z metadata krajiny; ak chýba, odvoď z jazyka (sk/cs) — konzervatívne.
  if (meta.market) return SUPPORTED_MARKETS.has(meta.market);
  return /^(sk|cs|cz)/.test(meta.language);
}

export interface Classification {
  classification: FeedClassification;
  blockers: string[];
  recommendedImportCap: number;
}

/**
 * Zaradí feed do triedy A–E podľa REÁLNYCH dát vzorky (nie podľa názvu).
 * Ústava §8/§9/§11: marketplace bez condition/sale-type nesmie byť eligible;
 * bez validnej identity max LOW_IDENTITY; nepodporovaná mena/trh nie je eligible.
 */
export function classifyFeed(m: FeedMetrics, meta: CjFeedMeta): Classification {
  const blockers: string[] = [];

  // E — bez produktov / bez ceny / bez odkazov
  if (m.sampleSize === 0) {
    return { classification: "INVALID_OR_EMPTY", blockers: ["no products sampled"], recommendedImportCap: 0 };
  }
  if (m.positivePricePercent < PRICE_MIN) blockers.push("insufficient positive prices");
  if (m.deepLinkPercent < DEEPLINK_MIN) blockers.push("missing product deep links");
  if (m.positivePricePercent < PRICE_MIN || m.deepLinkPercent < DEEPLINK_MIN) {
    return { classification: "INVALID_OR_EMPTY", blockers, recommendedImportCap: 0 };
  }

  // D — nepodporovaný trh / mena
  if (m.eurOrCzkPercent < CURRENCY_MIN) blockers.push("currency not predominantly EUR/CZK");
  if (!isSupportedMarket(meta)) blockers.push(`market not SK/CZ (${meta.market || meta.language || "?"})`);
  if (m.eurOrCzkPercent < CURRENCY_MIN || !isSupportedMarket(meta)) {
    return { classification: "UNSUPPORTED_MARKET", blockers, recommendedImportCap: 0 };
  }

  // B — marketplace / aukcie bez spoľahlivého condition alebo sale-type
  const marketplaceLike = isMarketplaceName(meta) || m.fixedPriceFieldPercent < FIXED_MIN;
  if (marketplaceLike && (m.conditionFieldPercent < CONDITION_MIN || m.fixedPriceFieldPercent < FIXED_MIN)) {
    blockers.push("marketplace/auction without reliable condition or sale-type fields");
    return { classification: "MARKETPLACE_RESTRICTED", blockers, recommendedImportCap: 0 };
  }

  // C — nízka identita (nedá sa porovnávať cena, len zobraziť vo vyhľadávaní)
  if (m.validEanPercent < EAN_MIN) {
    blockers.push(`low EAN/GTIN identity coverage (${m.validEanPercent}%)`);
    return {
      classification: "LOW_IDENTITY",
      blockers,
      recommendedImportCap: Math.min(meta.estimatedProductCount ?? CAP_LOW_IDENTITY, CAP_LOW_IDENTITY),
    };
  }

  // A — eligible
  return {
    classification: "ELIGIBLE_PRODUCT_FEED",
    blockers,
    recommendedImportCap: Math.min(meta.estimatedProductCount ?? CAP_ELIGIBLE, CAP_ELIGIBLE),
  };
}

// ── Anonymizovaná vzorka ─────────────────────────────────────────────────────
export function anonymizeSample(products: NormalizedProduct[], limit = 3): SampleProduct[] {
  return products.slice(0, limit).map((p) => ({
    title: (p.title ?? "").slice(0, 80),
    priceAmount: typeof p.priceAmount === "number" ? p.priceAmount : null,
    currency: p.currency ?? null,
    hasEan: !!(p.ean && EAN_RE.test(p.ean)),
    hasDeepLink: !!(p.link && /^https?:\/\//i.test(p.link)),
    brand: p.brand ?? null,
    availability: p.availability ?? null,
    condition: p.condition ?? null,
  }));
}

// ── Orchestrácia discovery ───────────────────────────────────────────────────
export interface DiscoveryOptions {
  token: string;
  companyId: string;
  checkpoint?: number;          // index feedu, od ktorého pokračovať
  maxFeeds?: number;            // strop feedov na jeden request (default derivovaný z 1000/25)
  joinedAdvertiserIds?: Set<string>; // read-only cross-check joined vzťahu
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
}

async function fetchFeeds(opts: DiscoveryOptions): Promise<CjFeedMeta[]> {
  const data = await cjGraphql<Record<string, unknown>>(
    FEEDS_QUERY,
    { companyId: opts.companyId },
    { token: opts.token, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs }
  );
  return asArray(data.shoppingProductFeeds).map(parseFeedMeta);
}

async function fetchProducts(
  opts: DiscoveryOptions,
  advertiserId: string,
  maxResults: number
): Promise<NormalizedProduct[]> {
  // Hard cap — nikdy viac než MAX_PRODUCTS_PER_FEED na feed.
  const capped = Math.min(maxResults, MAX_PRODUCTS_PER_FEED);
  const data = await cjGraphql<Record<string, unknown>>(
    PRODUCTS_QUERY,
    { companyId: opts.companyId, advertiserIds: [advertiserId], maxResults: capped, offset: 0 },
    { token: opts.token, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs }
  );
  return asArray(data.products).slice(0, capped).map(normalizeProduct);
}

/**
 * Objaví feedy, cross-checkne joined vzťah, navzorkuje (≤25/feed, ≤1000/request),
 * vypočíta metriky a klasifikuje. Číta iba — žiadny DB/Redis zápis.
 */
export async function discoverFeeds(opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const allFeeds = await fetchFeeds(opts);
  const joined = opts.joinedAdvertiserIds;

  // Feed musí patriť joined advertiserovi. Ak cache prázdna (joined nedostupné),
  // spoľahni sa na products query (vracia iba joined) — feed bez produktov sa
  // do reportu nezaradí.
  const haveJoined = !!joined && joined.size > 0;
  const candidates = haveJoined
    ? allFeeds.filter((f) => joined!.has(f.advertiserId))
    : allFeeds;

  const start = Math.max(0, opts.checkpoint ?? 0);
  const feedCeil = Math.max(1, Math.min(opts.maxFeeds ?? Math.floor(MAX_PRODUCTS_PER_REQUEST / MAX_PRODUCTS_PER_FEED), candidates.length));

  const feeds: FeedReport[] = [];
  let totalSampled = 0;
  let hasMore = false;
  let checkpoint: number | null = null;
  let i = start;

  for (; i < candidates.length; i++) {
    if (feeds.length >= feedCeil || totalSampled >= MAX_PRODUCTS_PER_REQUEST) {
      hasMore = true;
      checkpoint = i;
      break;
    }
    const meta = candidates[i];
    const remaining = MAX_PRODUCTS_PER_REQUEST - totalSampled;
    const cap = Math.min(MAX_PRODUCTS_PER_FEED, remaining);

    const products = await fetchProducts(opts, meta.advertiserId, cap);
    totalSampled += products.length;

    // Bez joined cache: feed bez produktov nedokážeme potvrdiť ako joined ⇒ preskoč.
    if (!haveJoined && products.length === 0) continue;

    const metrics = computeFeedMetrics(products);
    const { classification, blockers, recommendedImportCap } = classifyFeed(metrics, meta);

    feeds.push({
      advertiserId: meta.advertiserId,
      advertiserName: meta.advertiserName,
      feedId: meta.feedId,
      feedName: meta.feedName,
      market: meta.market,
      currency: meta.currency || products.find((p) => p.currency)?.currency || "",
      estimatedProductCount: meta.estimatedProductCount,
      sampleSize: metrics.sampleSize,
      metrics,
      classification,
      blockers,
      recommendedImportCap,
      sampleProducts: anonymizeSample(products),
    });
  }

  const advertiserIds = new Set(feeds.map((f) => f.advertiserId));
  return {
    ok: true,
    totalAdvertisers: advertiserIds.size,
    totalFeeds: feeds.length,
    totalSampledProducts: totalSampled,
    hasMore,
    checkpoint,
    feeds,
  };
}
