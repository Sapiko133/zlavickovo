/**
 * Fáza 2 — centralizácia outbound URL na produktových kartách + badge
 * „NAJNIŽŠIA CENA" vo vyhľadávaní.
 *
 * Spustenie: npx tsx scripts/test-outbound-search.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getOfferOutbound, getProductOutboundUrl } from "../lib/heureka/affiliate.ts";
import { findLowestPriceIndexes, resolveTrustedProductCurrency } from "../lib/price.ts";
import { outboundClickType } from "../lib/outbound-ui.ts";

const HAFF = "71186";
const RATE = 25;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function countParam(url: string, param: string): number {
  let count = 0;
  new URL(url).searchParams.forEach((_, key) => {
    if (key === param) count += 1;
  });
  return count;
}

// ── 1: search produkt s affiliate URL → direct affiliate (rovnaký vstup ako feed-search) ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const aff = "https://go.dognet.com/deeplink?url=https%3A%2F%2Fwww.alza.sk%2Fx";
  const outbound = getOfferOutbound({ affiliateUrl: aff, url: "https://www.alza.sk/x", name: "iPhone 16" });
  assert.equal(outbound.kind, "shop_affiliate");
  assert.equal(outbound.url, aff);
  assert.equal(outbound.monetized, true);
}

// ── 2–6: bez affiliate → Heureka fallback; haff práve raz; utm; bez positionid ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const outbound = getOfferOutbound({ affiliateUrl: null, url: "https://www.alza.sk/x", name: "iPhone 16" });
  assert.equal(outbound.kind, "heureka_fallback");
  assert.equal(outbound.monetized, true);
  const parsed = new URL(outbound.url);
  assert.equal(parsed.hostname, "www.heureka.sk");
  assert.equal(countParam(outbound.url, "haff"), 1);
  assert.equal(parsed.searchParams.get("haff"), HAFF);
  assert.equal(parsed.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(parsed.searchParams.get("utm_medium"), "affiliate");
  assert.equal(parsed.searchParams.has("positionid"), false);
}

// ── 7: CTA/tracking typ zodpovedá outbound typu ──
{
  assert.equal(outboundClickType("shop_affiliate"), "product_outbound");
  assert.equal(outboundClickType("direct_unmonetized"), "product_outbound");
  assert.equal(outboundClickType("heureka_fallback"), "heureka_fallback");

  // Search CTA nesmie tvrdiť „obchod", keď odkaz vedie na Heureku
  const search = src("app/hladat/SearchPageClient.tsx");
  assert.ok(search.includes('ctaIsHeureka ? "Porovnať ponuky na Heureke ↗" : "Otvoriť v obchode ↗"'));
  assert.ok(search.includes('ctaIsHeureka ? "heureka_fallback" : "product_outbound"'));
}

// ── 8: ShopProducts nepoužíva surové affiliate_url || url ──
{
  const code = src("components/ShopProducts.tsx");
  assert.ok(!/affiliate_url\s*\|\|/.test(code), "ShopProducts obsahuje affiliate_url ||");
  assert.ok(code.includes("getOfferOutbound"));
}

// ── 9: ShopPriceDrops nepoužíva surové affiliateUrl || url ──
{
  const code = src("components/ShopPriceDrops.tsx");
  assert.ok(!/affiliateUrl\s*\|\|/.test(code), "ShopPriceDrops obsahuje affiliateUrl ||");
  assert.ok(code.includes("getOfferOutbound"));
}

// ── 9b: search klient a API bez affiliate_url || url a bez ručného haff ──
{
  const search = src("app/hladat/SearchPageClient.tsx");
  assert.ok(!/affiliateUrl\s*\|\|\s*p\.url/.test(search), "SearchPageClient prepočítava affiliateUrl || url");
  assert.ok(!/haff=/.test(search), "SearchPageClient skladá haff ručne");

  for (const rel of ["app/api/feed-search/route.ts", "app/api/autocomplete/route.ts"]) {
    const code = src(rel);
    assert.ok(!/affiliateUrl\s*\|\|\s*p\.url/.test(code), `${rel} obsahuje affiliateUrl || p.url`);
    assert.ok(code.includes("getOfferOutbound"), `${rel} nepoužíva getOfferOutbound`);
  }
}

// ── 10: konzistentný outbound URL + typ + monetized (API kontrakt) ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const cases = [
    { affiliateUrl: "https://go.dognet.com/d?id=1", url: "https://www.alza.sk/x", name: "tv" },
    { affiliateUrl: null, url: "https://www.alza.sk/x", name: "tv" },
    { affiliateUrl: null, url: null, name: "tv" },
  ];
  for (const c of cases) {
    const outbound = getOfferOutbound(c);
    assert.equal(outbound.monetized, outbound.kind !== "direct_unmonetized");
    if (outbound.kind === "shop_affiliate") assert.equal(outbound.url, c.affiliateUrl);
    if (outbound.kind === "heureka_fallback") {
      assert.equal(new URL(outbound.url).hostname, "www.heureka.sk");
      assert.equal(new URL(outbound.url).searchParams.get("haff"), HAFF);
    }
  }
  // Wrapper pre vrstvy, ktoré potrebujú iba URL, vracia tú istú URL (jedna logika)
  const product = { affiliate_url: null, ean: "8588001234567", name: "iPhone 16" };
  assert.equal(getProductOutboundUrl(product), getOfferOutbound(product).url);

  // Bez haff env sa fallback nesmie tváriť ako monetizovaný
  delete process.env.HEUREKA_HAFF_ID;
  const unmonetized = getOfferOutbound({ affiliateUrl: null, url: null, name: "tv" });
  assert.equal(unmonetized.kind, "direct_unmonetized");
  assert.equal(unmonetized.monetized, false);
  assert.equal(new URL(unmonetized.url).searchParams.has("haff"), false);
  process.env.HEUREKA_HAFF_ID = HAFF;
}

// ── 11: 20 EUR vs. 500 CZK sa porovná cez kurz, nie ako 20 vs. 500 ──
{
  // 25 EUR vs. 599 CZK (= 23,96 EUR pri kurze 25) → vyhráva CZK ponuka
  const lowest = findLowestPriceIndexes(
    [
      { priceNum: 25, currency: "EUR" },
      { priceNum: 599, currency: "CZK" },
    ],
    RATE
  );
  assert.deepEqual([...lowest], [1]);

  // 20 EUR vs. 500 CZK pri kurze 25 = presná zhoda → obe najnižšie
  const tie = findLowestPriceIndexes(
    [
      { priceNum: 20, currency: "EUR" },
      { priceNum: 500, currency: "CZK" },
    ],
    RATE
  );
  assert.deepEqual([...tie].sort(), [0, 1]);
}

// ── 12: mix mien bez kurzu → žiadny badge ──
{
  const lowest = findLowestPriceIndexes(
    [
      { priceNum: 20, currency: "EUR" },
      { priceNum: 500, currency: "CZK" },
    ],
    null
  );
  assert.equal(lowest.size, 0);
}

// ── 13: rovnaká mena funguje bez kurzu ──
{
  const lowest = findLowestPriceIndexes(
    [
      { priceNum: 300, currency: "CZK" },
      { priceNum: 250, currency: "CZK" },
      { priceNum: null, currency: null }, // bez ceny — neblokuje porovnanie
    ],
    null
  );
  assert.deepEqual([...lowest], [1]);
}

// ── 14: neznáma mena nevytvorí nepravdivý badge ──
{
  const lowest = findLowestPriceIndexes(
    [
      { priceNum: 20, currency: "EUR" },
      { priceNum: 5, currency: null }, // platná cena, neznáma mena → porovnanie nedôveryhodné
    ],
    RATE
  );
  assert.equal(lowest.size, 0);

  // Menej než 2 ponuky s cenou → žiadne tvrdenie o najnižšej cene
  assert.equal(findLowestPriceIndexes([{ priceNum: 20, currency: "EUR" }], RATE).size, 0);

  // Dôveryhodná mena nepoužíva všeobecný TLD fallback (.sk ≠ automaticky EUR)
  assert.equal(resolveTrustedProductCurrency("599", null, "alza.sk"), null);
  assert.equal(resolveTrustedProductCurrency("12,99 EUR", null, "alza.sk"), "EUR");
  assert.equal(resolveTrustedProductCurrency("599", "CZK", "alza.sk"), "CZK");
  // Explicitne nakonfigurovaný feed zostáva dôveryhodný
  assert.equal(resolveTrustedProductCurrency("599", null, "kojenecke-obleceni.eu"), "CZK");
}

// ── 15: produktový detail (Fáza 1) — box aj CTA z tej istej ponuky ──
{
  const code = src("app/produkt/[slug]/page.tsx");
  assert.ok(code.includes("const outbound = getOfferOutbound(recommendedOffer ?? product);"));
  assert.ok(code.includes("const buyUrl = outbound.url;"));
  // Rovnaký vstup → deterministicky rovnaká URL pre odporúčanie, CTA aj JSON-LD
  const offer = { affiliate_url: "https://go.dognet.com/d?id=9", url: "https://www.alza.sk/x", ean: "123", name: "iPhone" };
  assert.equal(getOfferOutbound(offer).url, getOfferOutbound(offer).url);
}

console.log("Outbound centralization + search badge tests passed.");
