/**
 * Testy CJ Product Feed discovery (Fáza CJ-1) — read-only audit.
 *
 * JADRO (discoverFeeds + čisté funkcie) s injektnutým fetchImpl (bez siete):
 *  1. nikdy viac než 25 produktov/feed (maxResults request aj výsledok)
 *  2. nikdy viac než 1000 produktov/request + hasMore/checkpoint
 *  3. iba joined advertiseri (cross-check množinou)
 *  4. klasifikácia marketplace feedu (Aukro) → MARKETPLACE_RESTRICTED
 *  5. marketplace bez condition/sale-type NIE je eligible
 *  6. nepodporovaná mena (USD) NIE je eligible → UNSUPPORTED_MARKET
 *  7. feed bez CJ deep linku NIE je eligible → INVALID_OR_EMPTY
 *  8. čistý SK feed s EAN → ELIGIBLE_PRODUCT_FEED
 *  9. nízke EAN pokrytie → LOW_IDENTITY (import cap len na vyhľadávanie)
 *
 * ENDPOINT (POST /api/admin/cj-feed-discovery):
 *  A. bez CRON_SECRET → 401
 *  B. nesprávny secret → 401
 *  C. chýbajúce CJ credentials → 503
 *  D. CJ API auth chyba (401 z CJ) → bezpečný 502, token sa NEvypíše
 *
 * BEZPEČNOSŤ:
 *  - token sa neobjaví v odpovedi ani v console.error
 *  - žiadny DB/Redis zápis (route číta iba read-only cache; bez env → prázdne)
 *
 * Spustenie: npx tsx scripts/test-cj-feed-discovery.ts
 */
import assert from "node:assert/strict";
import {
  discoverFeeds,
  computeFeedMetrics,
  classifyFeed,
  normalizeProduct,
  getCjProductCredentials,
  MAX_PRODUCTS_PER_FEED,
  MAX_PRODUCTS_PER_REQUEST,
  type CjFeedMeta,
  type NormalizedProduct,
} from "../lib/cj-product-feed.ts";

// ── Fake CJ GraphQL server (fetchImpl) ────────────────────────────────────────
interface FakeFeed {
  advertiserId: string;
  advertiserName: string;
  feedName: string;
  feedTargetCountry: string;
  feedCurrency: string;
  feedLanguage: string;
  feedProductCount: number;
  products: Array<Record<string, unknown>>;
}

interface FakeState {
  maxResultsSeen: number[];
  productCalls: number;
}

function makeFakeFetch(feeds: FakeFeed[], state: FakeState) {
  const fetchImpl = async (_url: any, init?: any): Promise<any> => {
    const body = JSON.parse(init.body);
    const query: string = body.query;

    if (query.includes("shoppingProductFeeds")) {
      return jsonResponse({
        data: {
          shoppingProductFeeds: {
            resultList: feeds.map((f) => ({
              advertiserId: f.advertiserId,
              advertiserName: f.advertiserName,
              feedName: f.feedName,
              feedLanguage: f.feedLanguage,
              feedCurrency: f.feedCurrency,
              feedTargetCountry: f.feedTargetCountry,
              feedProductCount: f.feedProductCount,
              feedLastUpdated: "2026-07-12",
            })),
          },
        },
      });
    }

    // products query
    state.productCalls++;
    const advId = String(body.variables.advertiserIds[0]);
    const maxResults = Number(body.variables.maxResults);
    state.maxResultsSeen.push(maxResults);
    const feed = feeds.find((f) => f.advertiserId === advId);
    const list = (feed?.products ?? []).slice(0, maxResults);
    return jsonResponse({ data: { products: { totalCount: list.length, resultList: list } } });
  };
  return fetchImpl as unknown as typeof fetch;
}

function jsonResponse(obj: unknown, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  };
}

// Generátor produktu s dobrými dátami (SK, EUR, EAN, link, in-stock, new).
function goodProduct(i: number): Record<string, unknown> {
  return {
    title: `Produkt ${i}`,
    price: 19.9 + i,
    currency: "EUR",
    gtin: "8586001234567",
    brand: "BrandX",
    link: `https://www.anrdoezrs.net/click?u=obchod.sk/p/${i}`,
    imageLink: `https://img.example.sk/${i}.jpg`,
    availability: "in stock",
    condition: "new",
    saleType: "fixed",
  };
}

function feedWith(
  over: Partial<FakeFeed>,
  products: Array<Record<string, unknown>>
): FakeFeed {
  return {
    advertiserId: "1000",
    advertiserName: "Obchod",
    feedName: "Feed",
    feedTargetCountry: "SK",
    feedCurrency: "EUR",
    feedLanguage: "sk",
    feedProductCount: products.length,
    products,
    ...over,
  };
}

async function run() {
  // ── Čisté funkcie ──
  {
    const p = normalizeProduct(goodProduct(1));
    assert.equal(p.currency, "EUR");
    assert.equal(p.priceAmount! > 0, true);
    assert.equal(p.ean, "8586001234567");
    const m = computeFeedMetrics([p]);
    assert.equal(m.validEanPercent, 100);
    assert.equal(m.positivePricePercent, 100);
    assert.equal(m.deepLinkPercent, 100);
    assert.equal(m.eurOrCzkPercent, 100);
  }

  const skMeta: CjFeedMeta = {
    advertiserId: "1", advertiserName: "Obchod", feedId: "f", feedName: "Feed",
    market: "SK", currency: "EUR", language: "sk",
    estimatedProductCount: 5000, lastUpdated: null, availableFields: [],
  };

  // 8. čistý SK/EUR/EAN feed → ELIGIBLE
  {
    const products: NormalizedProduct[] = Array.from({ length: 20 }, (_, i) => normalizeProduct(goodProduct(i)));
    const c = classifyFeed(computeFeedMetrics(products), skMeta);
    assert.equal(c.classification, "ELIGIBLE_PRODUCT_FEED");
    assert.equal(c.recommendedImportCap, 5000, "cap = estimatedProductCount");
  }

  // 9. nízke EAN pokrytie → LOW_IDENTITY
  {
    const products: NormalizedProduct[] = Array.from({ length: 20 }, (_, i) => {
      const raw = goodProduct(i);
      if (i > 2) delete raw.gtin; // len 3/20 má EAN = 15 %
      return normalizeProduct(raw);
    });
    const c = classifyFeed(computeFeedMetrics(products), skMeta);
    assert.equal(c.classification, "LOW_IDENTITY");
    assert.equal(c.recommendedImportCap, 5000);
  }

  // 6. nepodporovaná mena (USD) → UNSUPPORTED_MARKET
  {
    const products: NormalizedProduct[] = Array.from({ length: 10 }, (_, i) => {
      const raw = goodProduct(i);
      raw.currency = "USD";
      return normalizeProduct(raw);
    });
    const c = classifyFeed(computeFeedMetrics(products), { ...skMeta, market: "US", currency: "USD" });
    assert.equal(c.classification, "UNSUPPORTED_MARKET");
  }

  // 7. feed bez deep linku → INVALID_OR_EMPTY
  {
    const products: NormalizedProduct[] = Array.from({ length: 10 }, (_, i) => {
      const raw = goodProduct(i);
      delete raw.link;
      return normalizeProduct(raw);
    });
    const c = classifyFeed(computeFeedMetrics(products), skMeta);
    assert.equal(c.classification, "INVALID_OR_EMPTY");
    assert.ok(c.blockers.some((b) => /deep link/i.test(b)));
  }

  // 4+5. marketplace (Aukro) bez condition/sale-type → MARKETPLACE_RESTRICTED, nie eligible
  {
    const products: NormalizedProduct[] = Array.from({ length: 20 }, (_, i) => {
      const raw = goodProduct(i);
      delete raw.condition; // žiadne condition pole
      delete raw.saleType;  // žiadny typ predaja
      return normalizeProduct(raw);
    });
    const meta: CjFeedMeta = { ...skMeta, advertiserName: "AUKRO CZ/SK", feedName: "Aukro feed" };
    const c = classifyFeed(computeFeedMetrics(products), meta);
    assert.equal(c.classification, "MARKETPLACE_RESTRICTED");
    assert.notEqual(c.classification, "ELIGIBLE_PRODUCT_FEED");
    assert.equal(c.recommendedImportCap, 0);
  }

  // ── discoverFeeds: caps + joined ──

  // 1+2. 60 feedov × 30 produktov, joined všetky → ≤25/feed, ≤1000/request, hasMore
  {
    const feeds: FakeFeed[] = Array.from({ length: 60 }, (_, f) =>
      feedWith(
        { advertiserId: String(2000 + f), advertiserName: `Obchod ${f}` },
        Array.from({ length: 30 }, (_, i) => goodProduct(i))
      )
    );
    const state: FakeState = { maxResultsSeen: [], productCalls: 0 };
    const joined = new Set(feeds.map((f) => f.advertiserId));
    const res = await discoverFeeds({
      token: "T", companyId: "1234567", joinedAdvertiserIds: joined,
      fetchImpl: makeFakeFetch(feeds, state),
    });
    assert.ok(res.totalSampledProducts <= MAX_PRODUCTS_PER_REQUEST, "≤1000/request");
    assert.ok(state.maxResultsSeen.every((n) => n <= MAX_PRODUCTS_PER_FEED), "≤25/feed request");
    assert.ok(res.feeds.every((f) => f.sampleSize <= MAX_PRODUCTS_PER_FEED), "≤25/feed výsledok");
    assert.equal(res.hasMore, true, "60 feedov > strop → hasMore");
    assert.equal(typeof res.checkpoint, "number");
    assert.equal(res.feeds.length, 40, "40 feedov × 25 = 1000");
    assert.equal(res.totalSampledProducts, 1000);
  }

  // 2b. checkpoint pokračovanie
  {
    const feeds: FakeFeed[] = Array.from({ length: 60 }, (_, f) =>
      feedWith(
        { advertiserId: String(2000 + f) },
        Array.from({ length: 30 }, (_, i) => goodProduct(i))
      )
    );
    const state: FakeState = { maxResultsSeen: [], productCalls: 0 };
    const joined = new Set(feeds.map((f) => f.advertiserId));
    const res = await discoverFeeds({
      token: "T", companyId: "1234567", checkpoint: 40, joinedAdvertiserIds: joined,
      fetchImpl: makeFakeFetch(feeds, state),
    });
    assert.equal(res.feeds.length, 20, "zvyšných 20 feedov");
    assert.equal(res.hasMore, false, "vyčerpané");
  }

  // 3. iba joined advertiseri — nejoined feed sa vynechá
  {
    const feeds: FakeFeed[] = [
      feedWith({ advertiserId: "5001", advertiserName: "Joined" }, [goodProduct(1), goodProduct(2)]),
      feedWith({ advertiserId: "5002", advertiserName: "NotJoined" }, [goodProduct(1)]),
    ];
    const state: FakeState = { maxResultsSeen: [], productCalls: 0 };
    const res = await discoverFeeds({
      token: "T", companyId: "1234567",
      joinedAdvertiserIds: new Set(["5001"]),
      fetchImpl: makeFakeFetch(feeds, state),
    });
    assert.equal(res.feeds.length, 1, "iba joined feed");
    assert.equal(res.feeds[0].advertiserId, "5001");
    assert.equal(state.productCalls, 1, "nejoined feed sa ani nesampluje");
  }

  // Sanity: vzorka je anonymizovaná (max 3, bez popisu)
  {
    const feeds: FakeFeed[] = [
      feedWith({ advertiserId: "6001" }, Array.from({ length: 10 }, (_, i) => goodProduct(i))),
    ];
    const res = await discoverFeeds({
      token: "T", companyId: "1234567", joinedAdvertiserIds: new Set(["6001"]),
      fetchImpl: makeFakeFetch(feeds, { maxResultsSeen: [], productCalls: 0 }),
    });
    assert.ok(res.feeds[0].sampleProducts.length <= 3, "max 3 ukážky");
    assert.ok(!("description" in res.feeds[0].sampleProducts[0]), "bez popisu");
  }

  // ── ENDPOINT auth / bezpečnosť ──
  const { POST } = await import("../app/api/admin/cj-feed-discovery/route.ts");
  const url = "https://www.zlavickovo.sk/api/admin/cj-feed-discovery";
  const makeReq = (headers: Record<string, string>) =>
    new Request(url, { method: "POST", headers }) as any;

  const orig = {
    CRON_SECRET: process.env.CRON_SECRET,
    CJ_PERSONAL_ACCESS_TOKEN: process.env.CJ_PERSONAL_ACCESS_TOKEN,
    CJ_COMPANY_ID: process.env.CJ_COMPANY_ID,
  };
  const SECRET = "test-secret";
  const TOKEN = "SUPER-SECRET-PAT-123";
  process.env.CRON_SECRET = SECRET;
  delete process.env.CJ_PERSONAL_ACCESS_TOKEN;
  delete process.env.CJ_COMPANY_ID;

  // A. bez secretu → 401
  {
    const res = await POST(makeReq({}));
    assert.equal(res.status, 401);
  }
  // B. nesprávny secret → 401
  {
    const res = await POST(makeReq({ authorization: "Bearer wrong" }));
    assert.equal(res.status, 401);
  }
  // C. chýbajúce CJ credentials → 503
  {
    const res = await POST(makeReq({ authorization: `Bearer ${SECRET}` }));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.ok, false);
  }

  // getCjProductCredentials helper
  {
    assert.equal(getCjProductCredentials({} as any), null);
    const c = getCjProductCredentials({ CJ_PERSONAL_ACCESS_TOKEN: "x", CJ_COMPANY_ID: "1" } as any);
    assert.equal(c?.companyId, "1");
  }

  // D. CJ API auth chyba → bezpečný 502, token sa NEvypíše
  {
    process.env.CJ_PERSONAL_ACCESS_TOKEN = TOKEN;
    process.env.CJ_COMPANY_ID = "1234567";

    const origFetch = globalThis.fetch;
    const origError = console.error;
    const logged: string[] = [];
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
    // CJ vráti 401
    globalThis.fetch = (async () => jsonResponse({ errors: [{ message: "unauthorized" }] }, 401)) as any;

    try {
      const res = await POST(makeReq({ authorization: `Bearer ${SECRET}` }));
      assert.equal(res.status, 502, "CJ auth chyba → 502");
      const body = await res.json();
      assert.equal(body.ok, false);
      const bodyStr = JSON.stringify(body);
      assert.ok(!bodyStr.includes(TOKEN), "token sa nesmie objaviť v odpovedi");
      assert.ok(!logged.join(" ").includes(TOKEN), "token sa nesmie objaviť v logu");
    } finally {
      globalThis.fetch = origFetch;
      console.error = origError;
    }
  }

  // obnov env
  for (const [k, v] of Object.entries(orig)) {
    if (v === undefined) delete (process.env as any)[k];
    else (process.env as any)[k] = v;
  }

  console.log("CJ feed discovery tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
