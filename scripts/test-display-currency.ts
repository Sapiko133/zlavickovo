import assert from "node:assert/strict";
import {
  findLowestPriceIndexes,
  getFormattedProductPrices,
  getFormattedProductPricesFromRaw,
  getPreferredDisplayCurrency,
  normalizeCurrencyCode,
  parsePriceValue,
} from "../lib/price";
import { pickBestPurchase, type BestPurchaseCandidate } from "../lib/heureka/best-purchase.ts";

const RATE = 25;
// Intl vkladá NBSP/narrow-NBSP — normalizujeme na obyčajnú medzeru kvôli porovnaniu
const normalizeSpaces = (value: string | null | undefined) => value?.replace(/\s/g, " ");

// ── Centrálne pravidlo .cz/.sk ──
{
  assert.equal(getPreferredDisplayCurrency("alza.cz", "EUR"), "CZK");
  assert.equal(getPreferredDisplayCurrency("alza.cz", "CZK"), "CZK");
  assert.equal(getPreferredDisplayCurrency("alza.sk", "CZK"), "EUR");
  assert.equal(getPreferredDisplayCurrency("alza.sk", "EUR"), "EUR");
  assert.equal(getPreferredDisplayCurrency("obchod.com", "CZK"), "CZK");
  assert.equal(getPreferredDisplayCurrency("kojenecke-obleceni.eu", "CZK"), "CZK");
  assert.equal(getPreferredDisplayCurrency(null, "EUR"), "EUR");
  assert.equal(getPreferredDisplayCurrency("  ALZA.CZ  ", "EUR"), "CZK");
}

// ── 1: .cz + pôvodná CZK → CZK primárna, EUR sekundárna (prepočet s ≈) ──
{
  const p = getFormattedProductPricesFromRaw("1 299", "CZK", "alza.cz", RATE);
  assert.equal(normalizeSpaces(p?.primary), "1 299 Kč");
  assert.equal(normalizeSpaces(p?.secondary), "≈ 51,96 €");
  assert.equal(p?.primaryCurrency, "CZK");
  assert.equal(p?.secondaryCurrency, "EUR");
}

// ── 2: .cz + pôvodná EUR → prepočítaná CZK primárna (s ≈), presná EUR sekundárna ──
{
  const p = getFormattedProductPricesFromRaw("51,96", "EUR", "obchod.cz", RATE);
  assert.equal(normalizeSpaces(p?.primary), "≈ 1 299 Kč");
  assert.equal(normalizeSpaces(p?.secondary), "51,96 €");
  assert.equal(p?.primaryCurrency, "CZK");
  assert.equal(p?.secondaryCurrency, "EUR");
}

// ── 3: .sk + pôvodná EUR → EUR primárna, CZK sekundárna ──
{
  const p = getFormattedProductPricesFromRaw("49,90", "EUR", "alza.sk", RATE);
  assert.equal(normalizeSpaces(p?.primary), "49,90 €");
  assert.equal(normalizeSpaces(p?.secondary), "≈ 1 248 Kč");
  assert.equal(p?.primaryCurrency, "EUR");
  assert.equal(p?.secondaryCurrency, "CZK");
}

// ── 4: .sk + pôvodná CZK → prepočítaná EUR primárna (s ≈), presná CZK sekundárna ──
{
  const p = getFormattedProductPricesFromRaw("1 248", "CZK", "obchod.sk", RATE);
  assert.equal(normalizeSpaces(p?.primary), "≈ 49,92 €");
  assert.equal(normalizeSpaces(p?.secondary), "1 248 Kč");
  assert.equal(p?.primaryCurrency, "EUR");
  assert.equal(p?.secondaryCurrency, "CZK");
}

// ── 5: doména bez .sk/.cz → pôvodné správanie, pôvodná mena primárna ──
{
  const p = getFormattedProductPricesFromRaw("1 299 Kč", null, "obchod.com", RATE);
  assert.equal(normalizeSpaces(p?.primary), "1 299 Kč");
  assert.equal(normalizeSpaces(p?.secondary), "≈ 51,96 €");
  assert.equal(p?.primaryCurrency, "CZK");
  // Konfigurovaný CZK feed na .eu doméne zostáva v CZK
  const eu = getFormattedProductPricesFromRaw("129", null, "kojenecke-obleceni.eu", RATE);
  assert.equal(normalizeSpaces(eu?.primary), "129 Kč");
  assert.equal(eu?.primaryCurrency, "CZK");
}

// ── 6: chýbajúci kurz → iba pôvodná cena, žiadny vymyslený prepočet, žiadny pád ──
{
  const p = getFormattedProductPricesFromRaw("51,96", "EUR", "obchod.cz", null);
  assert.equal(normalizeSpaces(p?.primary), "51,96 €");
  assert.equal(p?.secondary, null);
  assert.equal(p?.primaryCurrency, "EUR");
  assert.equal(p?.secondaryCurrency, null);

  const sk = getFormattedProductPricesFromRaw("1 248", "CZK", "obchod.sk", null);
  assert.equal(normalizeSpaces(sk?.primary), "1 248 Kč");
  assert.equal(sk?.secondary, null);
  assert.equal(sk?.primaryCurrency, "CZK");
}

// ── 7: neplatná cena → žiadna cena ──
{
  assert.equal(getFormattedProductPricesFromRaw("", "EUR", "obchod.cz", RATE), null);
  assert.equal(getFormattedProductPricesFromRaw("abc", "EUR", "obchod.cz", RATE), null);
  assert.equal(getFormattedProductPricesFromRaw("0", "EUR", "obchod.cz", RATE), null);
  assert.equal(getFormattedProductPrices(0, "EUR", RATE, "CZK"), null);
  // Neznáma mena bez konfigurácie → null aj s .cz preferenciou v hre
  assert.equal(getFormattedProductPricesFromRaw("49,90", null, "obchod.com", RATE), null);
}

// ── 8: JSON-LD vstupy (skutočná cena + mena) zostávajú v pôvodnej mene ──
{
  // Produktová stránka stavia schema Offer z parsePriceValue + normalizeCurrencyCode /
  // priceNum + currency_code odporúčanej ponuky — NIE z display formátovania.
  // .cz obchod s cenou uloženou v EUR: display primárna je CZK, ale schema
  // hodnoty zostávajú EUR.
  const schemaPrice = parsePriceValue("51,96");
  const schemaCurrency = normalizeCurrencyCode("EUR");
  assert.equal(schemaPrice, 51.96);
  assert.equal(schemaCurrency, "EUR");
  const display = getFormattedProductPricesFromRaw("51,96", "EUR", "obchod.cz", RATE);
  assert.equal(display?.primaryCurrency, "CZK"); // display preferencia
  assert.equal(schemaCurrency, "EUR");           // schema nedotknutá display preferenciou
}

// ── 9: ranking a isCheapest sa display preferenciou nemenia ──
{
  // pickBestPurchase porovnáva normalizované EUR hodnoty z raw cien — 250 CZK
  // (= 10 € pri kurze 25) vyhráva nad 15 € presne ako pred touto zmenou.
  const candidate = (overrides: Partial<BestPurchaseCandidate> & { id: number }): BestPurchaseCandidate => ({
    name: "Test produkt",
    price: "15",
    currency_code: "EUR",
    domain: "alza.sk",
    affiliate_url: null,
    url: "https://www.alza.sk/x",
    ean: "",
    ...overrides,
  });
  const best = pickBestPurchase(
    [
      candidate({ id: 1 }),
      candidate({ id: 2, price: "250", currency_code: "CZK", domain: "alza.cz", url: "https://www.alza.cz/x" }),
    ],
    RATE
  );
  assert.equal(best?.lowestOffer.domain, "alza.cz");
  assert.equal(best?.isLowestVerified, true);

  // findLowestPriceIndexes (badge isCheapest) pracuje s raw priceNum + dôveryhodnou
  // menou — display preferencia doň nevstupuje.
  const lowest = findLowestPriceIndexes(
    [
      { priceNum: 15, currency: "EUR" },
      { priceNum: 250, currency: "CZK" },
    ],
    RATE
  );
  assert.deepEqual([...lowest], [1]);
}

console.log("Display currency tests passed.");
