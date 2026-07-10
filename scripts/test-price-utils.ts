import assert from "node:assert/strict";
import {
  convertCzkToEur,
  convertEurToCzk,
  getEurToCzkRate,
  getFormattedProductPrices,
  getFormattedProductPricesFromRaw,
  normalizeCurrencyCode,
  parseProductPrice,
  parsePriceValue,
} from "../lib/price";
import { getProductOutboundUrl } from "../lib/heureka/affiliate.ts";

const RATE = 25;
// Intl vkladá NBSP/narrow-NBSP — normalizujeme na obyčajnú medzeru kvôli porovnaniu
const normalizeSpaces = (value: string | null | undefined) => value?.replace(/\s/g, " ");

// ── 1+2: prepočty EUR ↔ CZK ──
assert.equal(convertEurToCzk(49.9, RATE), 1247.5);
assert.equal(convertCzkToEur(1299, RATE), 51.96);

// ── 3: EUR zaokrúhlenie na 2 desatinné miesta (1299.9 / 25 = 51.996 → 52,00 €) ──
assert.equal(normalizeSpaces(getFormattedProductPrices(1299.9, "CZK", RATE)?.secondary), "≈ 52,00 €");

// ── 4: CZK zaokrúhlenie na celé koruny (49.9 × 25 = 1247.5 → 1 248 Kč) ──
assert.equal(normalizeSpaces(getFormattedProductPrices(49.9, "EUR", RATE)?.secondary), "≈ 1 248 Kč");

// ── 5–10: parsovanie rôznych formátov ceny ──
assert.equal(parsePriceValue("49.90"), 49.9);
assert.equal(parsePriceValue("49,90"), 49.9);
assert.equal(parsePriceValue("1 299,90 €"), 1299.9);
assert.equal(parsePriceValue("1 299.90 CZK"), 1299.9);
assert.equal(parsePriceValue("1.299,90"), 1299.9);
assert.equal(parsePriceValue("1,299.90"), 1299.9);
// "1 299,90" nesmie skončiť ako 129990
assert.equal(parsePriceValue("1 299,90"), 1299.9);
assert.equal(parsePriceValue("1 299 Kč"), 1299);
assert.equal(parsePriceValue("199,- Kč"), 199);

// ── 11–16: neplatné vstupy ──
assert.equal(parsePriceValue(null), null);
assert.equal(parsePriceValue(undefined), null);
assert.equal(parsePriceValue(""), null);
assert.equal(parsePriceValue("abc"), null);
assert.equal(parsePriceValue(Number.NaN), null);
assert.equal(parsePriceValue(Number.POSITIVE_INFINITY), null);

// ── 17: záporná cena nie je platná produktová cena ──
assert.equal(parsePriceValue(-49.9), null);
assert.equal(parsePriceValue("-49,90"), null);
assert.equal(parsePriceValue("- 49,90 €"), null);

// ── 18: nulová cena → žiadne "0 €" ──
assert.equal(parsePriceValue(0), null);
assert.equal(parsePriceValue("0 €"), null);
assert.equal(getFormattedProductPrices(0, "EUR", RATE), null);

// ── 19: chýbajúca mena → žiadne hádanie ──
assert.equal(parseProductPrice("49,90", null, null), null);
assert.equal(parseProductPrice("49,90", null, "obchod.com"), null);
assert.equal(getFormattedProductPricesFromRaw("49,90", null, null, RATE), null);
assert.equal(normalizeCurrencyCode(null), null);
assert.equal(normalizeCurrencyCode("USD"), null);
// Explicitná mena / mena z textu / konfigurovaná doména kurátorovaného feedu fungujú
assert.deepEqual(parseProductPrice("49,90 €", null, null), { amount: 49.9, currency: "EUR" });
assert.deepEqual(parseProductPrice("1 299 Kč", null, null), { amount: 1299, currency: "CZK" });
assert.deepEqual(parseProductPrice("49,90", "EUR", null), { amount: 49.9, currency: "EUR" });
assert.deepEqual(parseProductPrice("129", null, "obchod.cz"), { amount: 129, currency: "CZK" });
assert.deepEqual(parseProductPrice("129", null, "kojenecke-obleceni.eu"), { amount: 129, currency: "CZK" });

// ── 20: chýbajúci alebo neplatný kurz → primárna cena áno, sekundárna nie, žiadne 0/NaN ──
delete process.env.EUR_TO_CZK_RATE;
assert.equal(getEurToCzkRate(), null);
assert.equal(convertEurToCzk(10), null);
assert.equal(convertCzkToEur(250), null);
{
  const prices = getFormattedProductPrices(49.9, "EUR");
  assert.equal(normalizeSpaces(prices?.primary), "49,90 €");
  assert.equal(prices?.secondary, null);
}
process.env.EUR_TO_CZK_RATE = "abc";
assert.equal(getEurToCzkRate(), null);
assert.equal(getFormattedProductPrices(1299, "CZK")?.secondary, null);
process.env.EUR_TO_CZK_RATE = "0";
assert.equal(getEurToCzkRate(), null);
process.env.EUR_TO_CZK_RATE = "25";
assert.equal(getEurToCzkRate(), 25);
assert.equal(normalizeSpaces(getFormattedProductPrices(49.9, "EUR")?.secondary), "≈ 1 248 Kč");

// ── 21: veľmi vysoká cena ──
assert.equal(parsePriceValue("999 999 999,99 €"), 999999999.99);
assert.equal(parsePriceValue("1 234 567,89 EUR"), 1234567.89);
assert.equal(
  normalizeSpaces(getFormattedProductPrices(999999999.99, "EUR", RATE)?.primary),
  "999 999 999,99 €"
);

// ── 22: prepočet tam a späť s toleranciou zaokrúhlenia ──
{
  const rate = 24.735;
  const czk = convertEurToCzk(49.9, rate);
  assert.notEqual(czk, null);
  const backToEur = convertCzkToEur(czk as number, rate);
  assert.notEqual(backToEur, null);
  assert.ok(Math.abs((backToEur as number) - 49.9) < 0.005);
}

// ── Kompletné formátovanie primárnej + sekundárnej ceny ──
assert.deepEqual(
  Object.fromEntries(
    Object.entries(getFormattedProductPrices(49.9, "EUR", RATE) ?? {}).map(([key, value]) => [
      key,
      normalizeSpaces(value),
    ])
  ),
  {
    primary: "49,90 €",
    secondary: "≈ 1 248 Kč",
  }
);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(getFormattedProductPrices(1299, "CZK", RATE) ?? {}).map(([key, value]) => [
      key,
      normalizeSpaces(value),
    ])
  ),
  {
    primary: "1 299 Kč",
    secondary: "≈ 51,96 €",
  }
);
assert.equal(normalizeSpaces(getFormattedProductPricesFromRaw("1 299 Kč", null, null, RATE)?.secondary), "≈ 51,96 €");

// ── Currency zmeny nesmú ovplyvniť affiliate URL (invarianty z commitu e9f15fc) ──
{
  process.env.HEUREKA_HAFF_ID = "71186";

  // Vlastný affiliate_url produktu má prioritu — vracia sa nezmenený
  const own = "https://go.dognet.com/deeplink?url=https%3A%2F%2Fwww.alza.sk%2Fiphone";
  assert.equal(getProductOutboundUrl({ affiliate_url: own, ean: "123", name: "iPhone" }), own);

  // Heureka fallback stále používa haff + utm, žiadny positionid
  const fallback = new URL(getProductOutboundUrl({ affiliate_url: null, ean: "", name: "iPhone 16" }));
  assert.equal(fallback.hostname, "www.heureka.sk");
  assert.equal(fallback.searchParams.get("haff"), "71186");
  assert.equal(fallback.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(fallback.searchParams.get("utm_medium"), "affiliate");
  assert.equal(fallback.searchParams.has("positionid"), false);
}

console.log("Price utility tests passed");
