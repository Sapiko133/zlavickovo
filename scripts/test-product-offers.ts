import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  pickBestPurchase,
  getOtherOffersCopy,
  type BestPurchaseCandidate,
} from "../lib/heureka/best-purchase.ts";
import { getOfferOutbound } from "../lib/heureka/affiliate.ts";
import {
  exactDomainKey,
  buildOffersByExactDomain,
  type OfferRecord,
} from "../lib/offer-domain.ts";

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

function record(overrides: Partial<OfferRecord>): OfferRecord {
  return {
    shopName: "Alza",
    domain: "alza.sk",
    code: "ZLAVA10",
    title: "10% zľava",
    link: "https://go.dognet.com/d?id=1",
    validTo: null,
    ...overrides,
  };
}

// ── 1: EAN zhoda → sekcia „Ponuky rovnakého produktu", bez disclaimeru ──
{
  const copy = getOtherOffersCopy("ean");
  assert.equal(copy.title, "Ponuky rovnakého produktu");
  assert.equal(copy.disclaimer, null);
  assert.equal(copy.allowLowestBadge, true);
  assert.equal(copy.allowSavingsClaim, true);
}

// ── 2: manufacturer+productno → opatrný text „rovnaký model" ──
{
  const copy = getOtherOffersCopy("manufacturer_productno");
  assert.equal(copy.title, "Ponuky rovnakého modelu");
  assert.ok(copy.disclaimer && copy.disclaimer.includes("výrobcu"));
  assert.equal(copy.allowSavingsClaim, false);
}

// ── 3+4: name fallback → disclaimer, žiadna „najnižšia cena"/„ušetríte" ──
{
  const copy = getOtherOffersCopy("name");
  assert.equal(copy.title, "Podobné ponuky z iných obchodov");
  assert.ok(copy.disclaimer && copy.disclaimer.includes("podľa názvu"));
  assert.equal(copy.allowLowestBadge, false);
  assert.equal(copy.allowSavingsClaim, false);
  assert.ok(!copy.title.toLowerCase().includes("najnižšia"));
}

// ── 5: jedna doména sa v offers zobrazí iba raz (najlacnejšia platná ponuka) ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "899" }),
      candidate({ id: 2, price: "849" }), // tá istá doména, lacnejšia
      candidate({ id: 3, price: "950", domain: "datart.sk", url: "https://www.datart.sk/x" }),
    ],
    RATE,
    "ean"
  );
  assert.ok(best);
  assert.equal(best.offers.length, 2);
  const alza = best.offers.filter((o) => o.domain === "alza.sk");
  assert.equal(alza.length, 1);
  assert.equal(alza[0].priceNum, 849);
}

// ── 6: zoradenie po normalizácii EUR/CZK (250 CZK = 10 EUR < 15 EUR) ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "15", currency_code: "EUR", domain: "alza.sk" }),
      candidate({ id: 2, price: "250", currency_code: "CZK", domain: "alza.cz", url: "https://www.alza.cz/x" }),
    ],
    RATE,
    "ean"
  );
  assert.ok(best);
  assert.equal(best.offers[0].domain, "alza.cz");
  assert.equal(best.offers[1].domain, "alza.sk");
  assert.equal(best.offers[0].id, best.lowestOffer.id);
}

// ── 7: kupón sa pripojí iba k presnej doméne ──
{
  const index = buildOffersByExactDomain(
    [record({ domain: "alza.sk" }), record({ domain: "datart.sk", code: "DATART5", link: "https://go.dognet.com/d?id=2" })],
    ["alza.sk", "notino.sk"]
  );
  assert.ok(index.get("alza.sk")?.coupon);
  assert.equal(index.get("alza.sk")?.coupon?.code, "ZLAVA10");
  assert.equal(index.has("datart.sk"), false); // nepýtaná doména
  assert.equal(index.has("notino.sk"), false); // žiadny falošný kupón
}

// ── 8: .sk kupón sa nepripojí k .cz obchodu (TLD sa neodstrihuje) ──
{
  const index = buildOffersByExactDomain([record({ domain: "alza.sk" })], ["alza.cz"]);
  assert.equal(index.size, 0);
  // a naopak: presná zhoda vrátane www/protokolu funguje
  const exact = buildOffersByExactDomain([record({ domain: "https://www.alza.cz/kupony" })], ["alza.cz"]);
  assert.ok(exact.get("alza.cz")?.coupon);
}

// ── 8b: zdroj bez doménového údaja (len názov kampane) sa presne nepáruje ──
{
  assert.equal(exactDomainKey("Alza"), null);
  assert.equal(exactDomainKey(""), null);
  assert.equal(exactDomainKey("https://www.Alza.sk/x?a=1"), "alza.sk");
  const index = buildOffersByExactDomain([record({ domain: "Alza" })], ["alza.sk"]);
  assert.equal(index.size, 0);
}

// ── 9: ponuka bez kupónu sa stále zobrazí (offers nezávisia od kupónov) ──
{
  const best = pickBestPurchase(
    [
      candidate({ id: 1, price: "899" }),
      candidate({ id: 2, price: "950", domain: "datart.sk", url: "https://www.datart.sk/x" }),
    ],
    RATE,
    "ean"
  );
  assert.ok(best);
  const index = buildOffersByExactDomain([], ["alza.sk", "datart.sk"]);
  assert.equal(index.size, 0);
  // sekcia renderuje offers.slice — kupónový index prázdny nič neskryje
  assert.equal(best.offers.length, 2);
}

// ── 10: expirovaný kupón sa nezobrazí ako aktívny ──
{
  const index = buildOffersByExactDomain(
    [
      record({ validTo: "2020-01-01" }),
      record({ code: "", title: "Výpredaj", validTo: "2020-01-01" }),
    ],
    ["alza.sk"]
  );
  assert.equal(index.size, 0);
  const future = buildOffersByExactDomain([record({ validTo: "2099-01-01" })], ["alza.sk"]);
  assert.ok(future.get("alza.sk")?.coupon);
}

// ── 11: všeobecný kupón sa nezaráta do rankingu (ranking = len ceny ponúk) ──
{
  const withCoupon = pickBestPurchase(
    [
      candidate({ id: 1, price: "900", domain: "alza.sk" }),
      candidate({ id: 2, price: "899", domain: "datart.sk", url: "https://www.datart.sk/x" }),
    ],
    RATE,
    "ean"
  );
  assert.ok(withCoupon);
  // Aj keby alza.sk mala 10% kupón, ranking ho nepozná — vyhráva reálna cena
  assert.equal(withCoupon.lowestOffer.domain, "datart.sk");
}

// ── 12: každé CTA používa getOfferOutbound — affiliate má prioritu ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const aff = "https://go.dognet.com/deeplink?url=https%3A%2F%2Fwww.alza.sk%2Fx";
  const out = getOfferOutbound({ affiliate_url: aff, url: "https://www.alza.sk/x", ean: "8588001234567", name: "iPhone" });
  assert.equal(out.kind, "shop_affiliate");
  assert.equal(out.url, aff);
  assert.equal(out.monetized, true);
}

// ── 13+14: Heureka fallback má haff, utm_source, utm_medium; žiadny positionid ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const out = getOfferOutbound({ affiliate_url: null, url: "https://www.alza.sk/x", ean: "8588001234567", name: "iPhone 16" });
  assert.equal(out.kind, "heureka_fallback");
  const parsed = new URL(out.url);
  assert.equal(parsed.searchParams.get("haff"), HAFF);
  assert.equal(parsed.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(parsed.searchParams.get("utm_medium"), "affiliate");
  assert.equal(parsed.searchParams.has("positionid"), false);
}

// ── 15: žiadny návrat k affiliate_url || url — nevalidný affiliate nepretečie na url ──
{
  process.env.HEUREKA_HAFF_ID = HAFF;
  const out = getOfferOutbound({ affiliate_url: "javascript:alert(1)", url: "https://www.alza.sk/x", ean: "123", name: "iPhone" });
  assert.equal(out.kind, "heureka_fallback"); // nie direct — haff fallback má prednosť
}

// ── 16: bez ďalších ponúk sekcia nemá čo zobraziť (offers len odporúčaná) ──
{
  const best = pickBestPurchase([candidate({ id: 1 })], RATE, "ean");
  assert.ok(best);
  assert.equal(best.offers.length, 1);
  const others = best.offers.filter((o) => o.id !== best.lowestOffer.id);
  assert.equal(others.length, 0);
}

// ── 14b+15b+18: statická kontrola produktovej stránky — getOfferOutbound všade,
// žiadny positionid, žiadne affiliate_url || url, JSON-LD len z odporúčanej ponuky ──
{
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(dir, "..", "app", "produkt", "[slug]", "page.tsx"), "utf8");
  assert.ok(src.includes("getOfferOutbound"));
  assert.ok(!src.includes("positionid"));
  assert.ok(!/affiliate_url\s*(\|\||\?\?)\s*(offer|product|o|p)?\.?url/.test(src));
  // JSON-LD Offer vychádza len z recommendedOffer/product, nie zo zoznamu offers
  assert.ok(!/offers:\s*(bestPurchase|otherOffers)/.test(src));
  assert.ok(src.includes("schemaOffer"));
}

console.log("Product offers tests passed.");
