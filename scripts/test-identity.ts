import assert from "node:assert/strict";
import {
  getIdentityLevel,
  isPlaceholderEan,
  isValidEan,
  normalizeEan,
  normalizeManufacturer,
  normalizeProductNo,
} from "../lib/heureka/identity.ts";
import { getBestPurchaseCopy, pickBestPurchase, type BestPurchaseCandidate } from "../lib/heureka/best-purchase.ts";

const RATE = 25;

// ── EAN: validné GTIN ──
{
  // Validný GTIN-13
  assert.equal(normalizeEan("4006381333931"), "4006381333931");
  assert.equal(isValidEan("4006381333931"), true);
  // Validný GTIN-8
  assert.equal(normalizeEan("96385074"), "96385074");
  // Validný GTIN-12 (UPC-A)
  assert.equal(normalizeEan("036000291452"), "036000291452");
  // Normalizácia medzier a pomlčiek
  assert.equal(normalizeEan(" 4006381-333931 "), "4006381333931");
}

// ── EAN: neplatné hodnoty = identita neexistuje ──
{
  // Neplatný GTIN checksum
  assert.equal(normalizeEan("4006381333932"), null);
  // Nesprávna dĺžka (9 a 15 číslic)
  assert.equal(normalizeEan("400638133"), null);
  assert.equal(normalizeEan("400638133393112"), null);
  // Nečíselné znaky
  assert.equal(normalizeEan("ABC1234567890"), null);
  // Prázdna hodnota
  assert.equal(normalizeEan(""), null);
  assert.equal(normalizeEan(null), null);
}

// ── EAN: placeholdery ──
{
  for (const placeholder of [
    "00000000",
    "000000000000",
    "0000000000000",
    "00000000000000",
    "0000000000002",
    "1111111111111",
    "9999999999999",
    "1234567890123",
  ]) {
    assert.equal(isPlaceholderEan(placeholder.replace(/[\s-]/g, "")), true, `placeholder: ${placeholder}`);
    assert.equal(normalizeEan(placeholder), null, `placeholder EAN musí byť null: ${placeholder}`);
  }
  // Validný EAN nie je placeholder
  assert.equal(isPlaceholderEan("4006381333931"), false);
}

// ── manufacturer: normalizácia ──
{
  assert.equal(normalizeManufacturer("  Apple   Inc  "), "apple inc");
  assert.equal(normalizeManufacturer("SAMSUNG"), "samsung");
  assert.equal(normalizeManufacturer(""), null);
  assert.equal(normalizeManufacturer("   "), null);
  assert.equal(normalizeManufacturer(null), null);
  // Placeholder výrobca nesmie vytvoriť identitu
  assert.equal(normalizeManufacturer("N/A"), null);
  assert.equal(normalizeManufacturer("unknown"), null);
}

// ── productno: placeholdery a krátke hodnoty ──
{
  for (const placeholder of ["N/A", "n/a", "NA", "-", "--", "0", "X", "UNKNOWN", "unknown", "NULL", "null", "NONE"]) {
    assert.equal(normalizeProductNo(placeholder), null, `placeholder productno musí byť null: ${placeholder}`);
  }
  // Samé nuly a čistá interpunkcia
  assert.equal(normalizeProductNo("000"), null);
  assert.equal(normalizeProductNo("..."), null);
  // Extrémne krátke nečíselné hodnoty
  assert.equal(normalizeProductNo("AB"), null);
  // Čisto číselný krátky model je povolený
  assert.equal(normalizeProductNo("12"), "12");
  // Normalizácia whitespace, case sa zachováva
  assert.equal(normalizeProductNo("  AB  123  "), "AB 123");
  assert.equal(normalizeProductNo("MX-500"), "MX-500");
}

// ── getIdentityLevel ──
{
  // Validný EAN → ean
  assert.equal(getIdentityLevel({ ean: "4006381333931" }), "ean");
  // Validný manufacturer+productno bez EAN → manufacturer_productno
  assert.equal(
    getIdentityLevel({ ean: "", manufacturer: "Samsung", productno: "MX-500" }),
    "manufacturer_productno"
  );
  // Placeholder EAN sa preskočí → platí manufacturer+productno
  assert.equal(
    getIdentityLevel({ ean: "0000000000000", manufacturer: "Samsung", productno: "MX-500" }),
    "manufacturer_productno"
  );
  // productno "N/A" NESMIE vytvoriť match → name
  assert.equal(getIdentityLevel({ ean: "", manufacturer: "Samsung", productno: "N/A" }), "name");
  // productno "UNKNOWN" → name
  assert.equal(getIdentityLevel({ ean: "", manufacturer: "Samsung", productno: "UNKNOWN" }), "name");
  // Placeholder EAN + neplatné productno NESMIE vytvoriť silný match → name
  assert.equal(getIdentityLevel({ ean: "1111111111111", manufacturer: "Samsung", productno: "-" }), "name");
  // Chýbajúci manufacturer → name aj pri validnom productno
  assert.equal(getIdentityLevel({ ean: "", manufacturer: "", productno: "MX-500" }), "name");
  // Nič → name
  assert.equal(getIdentityLevel({}), "name");
}

// ── pickBestPurchase nesie identityLevel ──
{
  const candidate = (overrides: Partial<BestPurchaseCandidate> & { id: number }): BestPurchaseCandidate => ({
    name: "Test produkt",
    price: "10",
    currency_code: "EUR",
    domain: "alza.sk",
    affiliate_url: null,
    url: "https://www.alza.sk/x",
    ean: "4006381333931",
    ...overrides,
  });
  const candidates = [
    candidate({ id: 1 }),
    candidate({ id: 2, price: "12", domain: "datart.sk", url: "https://www.datart.sk/x" }),
  ];
  assert.equal(pickBestPurchase(candidates, RATE, "ean")?.identityLevel, "ean");
  assert.equal(pickBestPurchase(candidates, RATE, "manufacturer_productno")?.identityLevel, "manufacturer_productno");
  // Default je konzervatívny name
  assert.equal(pickBestPurchase(candidates, RATE)?.identityLevel, "name");
}

// ── UI texty podľa identity level (PROJECT_VISION §8–9) ──
{
  // EAN + overené porovnanie → plné tvrdenia
  const ean = getBestPurchaseCopy({ identityLevel: "ean", isLowestVerified: true, offerCount: 3 });
  assert.equal(ean.title, "Najvýhodnejšia kúpa");
  assert.ok(ean.subtitle.includes("Najnižšia cena"));
  assert.equal(ean.allowLowestBadge, true);
  assert.equal(ean.allowSavingsClaim, true);
  assert.equal(ean.ctaVerified, true);

  // manufacturer_productno → opatrnejší text, žiadny badge ani „ušetríš"
  const pair = getBestPurchaseCopy({ identityLevel: "manufacturer_productno", isLowestVerified: true, offerCount: 3 });
  assert.equal(pair.title, "Porovnané ponuky rovnakého modelu");
  assert.equal(pair.allowLowestBadge, false);
  assert.equal(pair.allowSavingsClaim, false);
  assert.equal(pair.ctaVerified, false);
  assert.doesNotMatch(pair.title + pair.subtitle, /najvýhodnejš|najnižš|ušetr/i);

  // name fallback → produktový detail NESMIE tvrdiť „najvýhodnejšia kúpa"
  // ani „najnižšia cena" ani „ušetríte" a musí priznať neistú zhodu
  const name = getBestPurchaseCopy({ identityLevel: "name", isLowestVerified: true, offerCount: 3 });
  assert.equal(name.title, "Podobné ponuky z iných obchodov");
  assert.doesNotMatch(name.title + name.subtitle, /najvýhodnejš|najnižš|ušetr/i);
  assert.equal(name.allowLowestBadge, false);
  assert.equal(name.allowSavingsClaim, false);
  assert.equal(name.ctaVerified, false);
  assert.ok(name.disclaimer && /názv/i.test(name.disclaimer));
  assert.ok(name.disclaimer && /nemusí/i.test(name.disclaimer));

  // Jediná ponuka → žiadne tvrdenia bez ohľadu na identitu
  const single = getBestPurchaseCopy({ identityLevel: "ean", isLowestVerified: false, offerCount: 1 });
  assert.equal(single.title, "Dostupná ponuka");
  assert.equal(single.allowLowestBadge, false);
  assert.equal(single.ctaVerified, false);
}

console.log("Identity tests passed.");
