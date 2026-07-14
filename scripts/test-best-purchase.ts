import assert from "node:assert/strict";
import { pickBestPurchase, type BestPurchaseCandidate } from "../lib/heureka/best-purchase.ts";
import { getOfferOutbound } from "../lib/heureka/affiliate.ts";

const RATE = 25;
const HAFF = "71186";

function candidate(overrides: Partial<BestPurchaseCandidate> & { id: number }): BestPurchaseCandidate {
  return {
    name: "iPhone 16 128GB",
    price: "999",
    currency_code: "EUR",
    domain: "alza.sk",
    affiliate_url: null,
    url: "https://www.alza.sk/iphone-16",
    ean: "8588001234567",
    ...overrides,
  };
}

function countParam(url: string, param: string): number {
  let count = 0;
  new URL(url).searchParams.forEach((_, key) => {
    if (key === param) count += 1;
  });
  return count;
}

// ── 1: odporúčaná ponuka a CTA používajú rovnakú URL ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const aff = "https://go.dognet.com/deeplink?url=https%3A%2F%2Fwww.alza.sk%2Fiphone";
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "899", affiliate_url: aff }),
      candidate({ id: 2, price: "949", domain: "datart.sk", url: "https://www.datart.sk/iphone" }),
    ],
    RATE
  );
  assert.ok(best);
  assert.equal(best.lowestOffer.domain, "alza.sk");
  const outbound = getOfferOutbound(best.lowestOffer);
  // CTA href = outbound.url = affiliate_url tej istej odporúčanej ponuky
  assert.equal(outbound.url, best.lowestOffer.affiliate_url);
}

// ── 2: priamy affiliate má prioritu pred Heureka fallbackom ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const aff = "https://go.dognet.com/deeplink?id=abc";
  const outbound = getOfferOutbound({ affiliate_url: aff, url: "https://www.alza.sk/x", ean: "123", name: "iPhone" });
  assert.equal(outbound.kind, "shop_affiliate");
  assert.equal(outbound.url, aff);
}

// ── 3+4+5: bez affiliate → Heureka haff fallback; haff práve raz; bez positionid ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const outbound = getOfferOutbound({ affiliate_url: null, url: "https://www.alza.sk/x", ean: "8588001234567", name: "iPhone 16" });
  assert.equal(outbound.kind, "heureka_fallback");
  const parsed = new URL(outbound.url);
  assert.equal(parsed.hostname, "www.heureka.sk");
  assert.equal(parsed.searchParams.get("haff"), HAFF);
  assert.equal(countParam(outbound.url, "haff"), 1);
  assert.equal(parsed.searchParams.has("positionid"), false);
  assert.equal(parsed.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(parsed.searchParams.get("utm_medium"), "affiliate");
  // EAN má prednosť pred názvom
  assert.equal(parsed.searchParams.get("h[fraze]"), "8588001234567");
}

// ── 6: EUR a CZK sa neporovnávajú ako surové čísla ──
{
  // 250 CZK (= 10 EUR pri kurze 25) je lacnejších než 15 EUR, hoci 250 > 15
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "15", currency_code: "EUR", domain: "alza.sk" }),
      candidate({ id: 2, price: "250", currency_code: "CZK", domain: "alza.cz", url: "https://www.alza.cz/x" }),
    ],
    RATE
  );
  assert.ok(best);
  assert.equal(best.lowestOffer.domain, "alza.cz");
  assert.equal(best.isLowestVerified, true);
  // Rozdiel cien sa pri rôznych menách netvrdí surovými číslami
  assert.equal(best.priceDifference, null);
}

// ── 7: ponuka bez rozpoznateľnej meny nedostane „najnižšiu cenu" voči inej mene ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "20", currency_code: "EUR", domain: "alza.sk" }),
      // .com doména, bez meny v cene aj v currency_code → mena sa nedá určiť
      candidate({ id: 2, price: "5", currency_code: null, domain: "shop.com", url: "https://shop.com/x" }),
    ],
    RATE
  );
  assert.ok(best);
  assert.equal(best.lowestOffer.domain, "alza.sk");
  assert.equal(best.offerCount, 1);
  assert.equal(best.excludedCount, 1);
  // Jediná porovnaná ponuka → žiadne tvrdenie o najnižšej cene
  assert.equal(best.isLowestVerified, false);
}

// ── 8: chýbajúci kurz nespôsobí chybný cross-currency ranking ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "20", currency_code: "EUR", domain: "alza.sk" }),
      candidate({ id: 2, price: "250", currency_code: "CZK", domain: "alza.cz", url: "https://www.alza.cz/x" }),
    ],
    null // kurz nedostupný
  );
  assert.ok(best);
  // CZK ponuku bez kurzu nemožno porovnať → vylúčená, vyhráva jediná EUR ponuka
  assert.equal(best.lowestOffer.domain, "alza.sk");
  assert.equal(best.offerCount, 1);
  assert.equal(best.excludedCount, 1);
  assert.equal(best.isLowestVerified, false);

  // Bez kurzu ale s jednotnou menou porovnanie normálne funguje
  const czkOnly = pickBestPurchase(
    [
      candidate({ id: 1, price: "300", currency_code: "CZK", domain: "alza.cz", url: "https://www.alza.cz/x" }),
      candidate({ id: 2, price: "250", currency_code: "CZK", domain: "datart.cz", url: "https://www.datart.cz/x" }),
    ],
    null
  );
  assert.ok(czkOnly);
  assert.equal(czkOnly.lowestOffer.domain, "datart.cz");
  assert.equal(czkOnly.isLowestVerified, true);
  assert.equal(czkOnly.priceDifference, 50);
}

// ── 9: jedna ponuka nevytvorí nepravdivé tvrdenie o globálne najnižšej cene ──
{
  const best = pickBestPurchase([candidate({ id: 1 })], RATE);
  assert.ok(best);
  assert.equal(best.offerCount, 1);
  assert.equal(best.secondOffer, null);
  assert.equal(best.isLowestVerified, false);
}

// ── 10: neplatná alebo chýbajúca URL nespôsobí pád ──
{
  // Kandidát bez akejkoľvek použiteľnej URL sa vylúči
  const best = pickBestPurchase(
    [
      candidate({ id: 1, url: null, affiliate_url: null }),
      candidate({ id: 2, url: "javascript:alert(1)", affiliate_url: "not-a-url", domain: "datart.sk" }),
    ],
    RATE
  );
  assert.equal(best, null);

  // Prázdny vstup → null, žiadna výnimka
  assert.equal(pickBestPurchase([], RATE), null);

  // Outbound pre ponuku bez URL: s haff → monetizovaný Heureka fallback
  process.env.HEUREKA_HAFF_ID = HAFF;
  const withHaff = getOfferOutbound({ affiliate_url: null, url: null, ean: "", name: "notebook" });
  assert.equal(withHaff.kind, "heureka_fallback");
  assert.equal(new URL(withHaff.url).searchParams.get("haff"), HAFF);

  // Bez haff aj bez URL → nemonetizovaná Heureka ako posledná záchrana (stránka nespadne)
  delete process.env.HEUREKA_HAFF_ID;
  const lastResort = getOfferOutbound({ affiliate_url: null, url: null, ean: "", name: "notebook" });
  assert.equal(lastResort.kind, "direct_unmonetized");
  assert.equal(new URL(lastResort.url).hostname, "www.heureka.sk");
  assert.equal(new URL(lastResort.url).searchParams.has("haff"), false);

  // Bez haff s platnou priamou URL → nemonetizovaný priamy link (priorita 4)
  const direct = getOfferOutbound({ affiliate_url: null, url: "https://www.alza.sk/x", name: "notebook" });
  assert.equal(direct.kind, "direct_unmonetized");
  assert.equal(direct.url, "https://www.alza.sk/x");
}

// ── Tie-breakery (PROJECT_VISION §9): rovnaká cena → affiliate, potom doména abecedne ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "99", domain: "zzz.sk", affiliate_url: "https://go.dognet.com/d?id=1", url: "https://zzz.sk/x" }),
      candidate({ id: 2, price: "99", domain: "aaa.sk", affiliate_url: null, url: "https://aaa.sk/x" }),
      candidate({ id: 3, price: "99", domain: "bbb.sk", affiliate_url: "https://go.dognet.com/d?id=3", url: "https://bbb.sk/x" }),
    ],
    RATE
  );
  assert.ok(best);
  // Monetizované ponuky pred nemonetizovanou, medzi nimi abecedne
  assert.equal(best.lowestOffer.domain, "bbb.sk");
}

console.log("Best purchase tests passed.");
