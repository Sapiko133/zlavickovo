import assert from "node:assert/strict";
import { dedupeOffers, offerFingerprint, type DedupeOffer } from "../lib/offers/dedupe.ts";

// Ten istý Bonprix kupón z Dognetu aj Affialu (rovnaký kód) = jedna ponuka.
{
  const offers: DedupeOffer[] = [
    { source: "dognet", shopName: "Bonprix", code: "leto20", validTo: "2026-12-31", title: "20 % zľava" },
    { source: "affial", shopName: "bonprix", code: "LETO20", validTo: null, title: "Zľava 20 %" },
  ];
  const groups = dedupeOffers(offers);
  assert.equal(groups.length, 1, "rovnaký kód z 2 sietí sa má zlúčiť");
  assert.equal(groups[0].sources.length, 2);
  // Kanonická je úplnejšia (má validTo).
  assert.equal(groups[0].canonical.source, "dognet");
}

// Tá istá akcia bez kódu z 2 sietí (rovnaký obchod/názov/zľava/validita) = raz.
{
  const offers: DedupeOffer[] = [
    { source: "affial", shopName: "Bonprix", title: "Doprava zadarmo", discountPct: null, validTo: "2026-09-30" },
    { source: "dognet", shopName: "Bonprix", title: "doprava zadarmo", discountPct: null, validTo: "2026-09-30" },
  ];
  assert.equal(dedupeOffers(offers).length, 1);
}

// Odlišné KÓDY v tom istom obchode sa NEzlúčia.
{
  const offers: DedupeOffer[] = [
    { source: "dognet", shopName: "Bonprix", code: "A10" },
    { source: "dognet", shopName: "Bonprix", code: "B20" },
  ];
  assert.equal(dedupeOffers(offers).length, 2);
}

// Akcie bez kódu s odlišnou PLATNOSŤOU sa NEzlúčia.
{
  const offers: DedupeOffer[] = [
    { source: "dognet", shopName: "Nike", title: "Výpredaj", validTo: "2026-09-01" },
    { source: "dognet", shopName: "Nike", title: "Výpredaj", validTo: "2026-10-01" },
  ];
  assert.equal(dedupeOffers(offers).length, 2);
}

// Rovnaký kód v RÔZNYCH obchodoch = rôzne ponuky.
{
  const offers: DedupeOffer[] = [
    { source: "dognet", shopName: "Alza", code: "SAVE5" },
    { source: "dognet", shopName: "Nike", code: "SAVE5" },
  ];
  assert.equal(dedupeOffers(offers).length, 2);
}

// Produktová identita rozlišuje inak rovnaké ponuky.
{
  const offers: DedupeOffer[] = [
    { source: "dognet", shopName: "Alza", title: "Zľava", productKey: "ean:111" },
    { source: "dognet", shopName: "Alza", title: "Zľava", productKey: "ean:222" },
  ];
  assert.equal(dedupeOffers(offers).length, 2);
}

// Fingerprint je stabilný voči diakritike/veľkosti/medzerám v kóde.
assert.equal(
  offerFingerprint({ source: "x", shopName: "Bonprix", code: " le to20 " }),
  offerFingerprint({ source: "y", shopName: "bonprix", code: "LETO20" }),
);

// Determinizmus: rovnaký vstup → identický výstup.
{
  const offers: DedupeOffer[] = [
    { source: "affial", shopName: "Bonprix", code: "X1", title: "a" },
    { source: "dognet", shopName: "Bonprix", code: "X1", title: "aaaaaaaaaaaaaaaaaaaaaa" },
  ];
  const a = dedupeOffers(offers);
  const b = dedupeOffers(offers);
  assert.deepEqual(a, b);
  // Kanonická = úplnejší (dlhší) titul.
  assert.equal(a[0].canonical.source, "dognet");
}

console.log("Offer dedupe tests passed.");
