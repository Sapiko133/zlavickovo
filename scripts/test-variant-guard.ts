import assert from "node:assert/strict";
import {
  extractVariantSignature,
  variantsConflict,
  filterVariantConflicts,
} from "../lib/heureka/variant.ts";

// ── Podpisy: hmotnosť sa zjednotí na gramy ──
{
  assert.equal(extractVariantSignature("Collagen 10g").weight, 10);
  assert.equal(extractVariantSignature("Protein 0,5kg").weight, 500);
  assert.equal(extractVariantSignature("Protein 0.5 kg").weight, 500);
  assert.equal(extractVariantSignature("Vitamín 1000mg").weight, 1);
  assert.equal(extractVariantSignature("Vitamín 1g").weight, 1);
  // 25 × 10 g → 250 g (multiplikátor), amount „10 g" sa nezapočíta druhýkrát
  assert.equal(extractVariantSignature("Box 25 x 10g").weight, 250);
  assert.equal(extractVariantSignature("Box 25×10 g").weight, 250);
  assert.equal(extractVariantSignature("Box 25*10g").weight, 250);
}

// ── Podpisy: objem sa zjednotí na ml ──
{
  assert.equal(extractVariantSignature("Nápoj 250ml").volume, 250);
  assert.equal(extractVariantSignature("Nápoj 500 ml").volume, 500);
  assert.equal(extractVariantSignature("Olej 1l").volume, 1000);
  assert.equal(extractVariantSignature("Olej 1 l").volume, 1000);
  assert.equal(extractVariantSignature("Ampulka 5cl").volume, 50);
  // 2 × 250 ml = 500 ml
  assert.equal(extractVariantSignature("Balenie 2 x 250 ml").volume, 500);
}

// ── Podpisy: počet (SK aj CZ tvary jednotiek) ──
{
  assert.equal(extractVariantSignature("30 kapsúl").count, 30);
  assert.equal(extractVariantSignature("120 kapsúl").count, 120);
  assert.equal(extractVariantSignature("60 kapslí").count, 60); // CZ
  assert.equal(extractVariantSignature("90 tabliet").count, 90);
  assert.equal(extractVariantSignature("90 tablet").count, 90); // CZ
  assert.equal(extractVariantSignature("1 ks").count, 1);
  assert.equal(extractVariantSignature("2 ks").count, 2);
  assert.equal(extractVariantSignature("10 sáčkov").count, 10);
  assert.equal(extractVariantSignature("10 sáčků").count, 10); // CZ
  assert.equal(extractVariantSignature("5 vreciek").count, 5);
}

// ── Double-count fix: total + jeho multiplikátorový rozpis sa nesčíta ──
{
  // headline total aj rozpis uvádzajú to isté množstvo → jedna hodnota
  assert.equal(extractVariantSignature("40 g (10×4 g)").weight, 40);
  assert.equal(extractVariantSignature("100 g (25×4 g)").weight, 100);
  assert.equal(extractVariantSignature("45 g 15×3 g").weight, 45);
  assert.equal(extractVariantSignature("30 ml 3×10 ml").volume, 30);
  assert.equal(extractVariantSignature("2×250 ml 500 ml").volume, 500);
  // samotný multiplikátor bez headline totalu zostáva funkčný
  assert.equal(extractVariantSignature("25×10 g").weight, 250);
  // reálne Samahan varianty: total = rozpis → linkovateľné s čistým totalom
  assert.equal(extractVariantSignature("Samahan 40g 10x4g").weight, 40);
  assert.equal(extractVariantSignature("Samahan 400g 100 x 4g").weight, 400);
  assert.equal(extractVariantSignature("Samahan 100 x 4g").weight, 400); // len rozpis → 400
}

// ── Konzistentné total vs rozpis: rovnaké čisté množstvo → bez konfliktu ──
{
  assert.equal(variantsConflict("Samahan 100 g", "Samahan 25×4 g"), false); // 100 = 100
  assert.equal(variantsConflict("Samahan 400 g", "Samahan 100×4 g"), false); // 400 = 400
  assert.equal(variantsConflict("Samahan 40 g", "Samahan 10×4 g"), false); // 40 = 40
  // reálne Samahan URL sa navzájom neblokujú
  assert.equal(variantsConflict("Samahan 400g 100 x 4g", "Samahan 400 g"), false);
  assert.equal(variantsConflict("Samahan 400g 100 x 4g", "Samahan 100 x 4g"), false);
}

// ── Nekonzistentný názov: headline total prebíja rozpis, konflikt sa zachová ──
{
  // 100 g headline vs 10×4 g rozpis (=40) → berieme 100 g, s čistým 10×4 g je konflikt
  assert.equal(variantsConflict("Samahan 100 g", "Samahan 10×4 g"), true); // 100 vs 40
  // headline total ostáva pre porovnanie s odlišným balením
  assert.equal(extractVariantSignature("100 g (10×4 g)").weight, 100); // nie 140, nie 40
}

// ── Desatinná čiarka aj bodka sa spracujú rovnako ──
{
  assert.equal(extractVariantSignature("4,7g").weight, extractVariantSignature("4.7g").weight);
  assert.equal(extractVariantSignature("Box 30 x 4,7g").weight, 141);
}

// ── Rozmery a modelové čísla sa NESMÚ zachytiť ──
{
  const matrac = extractVariantSignature("Matrac 90x200");
  assert.equal(matrac.weight, null);
  assert.equal(matrac.volume, null);
  assert.equal(matrac.count, null);

  const monitor = extractVariantSignature("Monitor 1920x1080");
  assert.equal(monitor.weight, null);
  assert.equal(monitor.volume, null);
  assert.equal(monitor.count, null);

  // číslo v názve modelu bez jednotky
  const iphone = extractVariantSignature("iPhone 15");
  assert.deepEqual(iphone, { weight: null, volume: null, count: null });
  assert.deepEqual(extractVariantSignature("iPhone 15 Pro"), { weight: null, volume: null, count: null });
  // rozmer s cm (nepodporovaná jednotka) nesmie dať podpis
  assert.deepEqual(extractVariantSignature("Matrac 90x200 cm"), { weight: null, volume: null, count: null });
}

// ── Konflikt: rovnaká dimenzia, rozdielne hodnoty ──
{
  assert.equal(variantsConflict("Collagen 10g", "Collagen Box 25 x 10g"), true);
  assert.equal(variantsConflict("Doplnok 30 kapsúl", "Doplnok 120 kapsúl"), true);
  assert.equal(variantsConflict("Nápoj 250ml", "Nápoj 500ml"), true);
  assert.equal(variantsConflict("Produkt 1 ks", "Produkt 2 ks"), true);
}

// ── Bez konfliktu: ekvivalentné množstvá po normalizácii ──
{
  assert.equal(variantsConflict("Balenie 2 x 250ml", "Fľaša 500ml"), false); // 500 = 500
  assert.equal(variantsConflict("Protein 0,5kg", "Protein 500g"), false); // 500 = 500
  assert.equal(variantsConflict("Vitamín 1000mg", "Vitamín 1g"), false); // 1 = 1
  assert.equal(variantsConflict("Olej 1l", "Olej 1000ml"), false); // 1000 = 1000
}

// ── Chýbajúca jednotka na jednej strane NEvytvorí konflikt ──
{
  // jedna strana bez množstva → nie je potvrdený konflikt
  assert.equal(variantsConflict("Collagen 10g", "Collagen Príchuť Vanilka"), false);
  assert.equal(variantsConflict("iPhone 15", "iPhone 15 Pro"), false);
  // rozdielne dimenzie (hmotnosť vs počet) sa neporovnávajú
  assert.equal(variantsConflict("Doplnok 100g", "Doplnok 30 kapsúl"), false);
}

// ── Filter sa aplikuje pri ean ──
{
  const seed = { id: 1, name: "Collagen Box 25 x 10g" };
  const candidates = [
    { id: 1, name: "Collagen Box 25 x 10g" }, // seed sám
    { id: 2, name: "Collagen 10g" }, // konflikt 10 vs 250
    { id: 3, name: "Collagen 350g" }, // konflikt 350 vs 250
    { id: 4, name: "Collagen Box 25 x 10g Vanilka" }, // 250 = 250 → OK
  ];
  const res = filterVariantConflicts(seed, candidates, true /* identityLevel !== name */);
  assert.deepEqual(res.kept.map((c) => c.id), [1, 4]);
  assert.equal(res.excludedCount, 2);
}

// ── Filter sa aplikuje pri manufacturer_productno (rovnaká apply=true vetva) ──
{
  const seed = { id: 10, name: "Nápoj 250ml" };
  const candidates = [
    { id: 10, name: "Nápoj 250ml" },
    { id: 11, name: "Nápoj 500ml" }, // konflikt
    { id: 12, name: "Nápoj 250ml Limetka" }, // OK
  ];
  const res = filterVariantConflicts(seed, candidates, true);
  assert.deepEqual(res.kept.map((c) => c.id), [10, 12]);
  assert.equal(res.excludedCount, 1);
}

// ── Filter sa NEaplikuje pri name (apply=false) ──
{
  const seed = { id: 20, name: "Collagen 10g" };
  const candidates = [
    { id: 20, name: "Collagen 10g" },
    { id: 21, name: "Collagen Box 25 x 10g" }, // konfliktný, no pri name sa nefiltruje
  ];
  const res = filterVariantConflicts(seed, candidates, false /* identityLevel === name */);
  assert.deepEqual(res.kept.map((c) => c.id), [20, 21]);
  assert.equal(res.excludedCount, 0);
}

// ── excludedCount sa navýši presne o odfiltrované varianty ──
{
  const seed = { id: 30, name: "Box 25 x 10g" };
  const candidates = [
    { id: 30, name: "Box 25 x 10g" },
    { id: 31, name: "Vrecko 10g" },
    { id: 32, name: "Vrecko 20g" },
    { id: 33, name: "Box 25 x 10g iná príchuť" },
  ];
  const res = filterVariantConflicts(seed, candidates, true);
  assert.equal(res.excludedCount, 2); // id 31 a 32
  assert.equal(res.kept.length, 2); // seed + zhodné balenie
}

// ── Reálny prípad z auditu: Superstrava Collagen 10g vs Box 25 x 10g ──
{
  const tenG = "Superstrava Supestrava Super Collagen 10g";
  const box = "Superstrava Supestrava Super Collagen Box 25 x 10g";
  const g350 = "Superstrava Supestrava Super Collagen 350g";
  assert.equal(variantsConflict(box, tenG), true); // 250 g vs 10 g
  assert.equal(variantsConflict(box, g350), true); // 250 g vs 350 g
  assert.equal(variantsConflict(tenG, g350), true); // 10 g vs 350 g

  // Na stránke Boxu: 10 g aj 350 g vypadnú, ostane len samotný Box
  const boxSeed = { id: 325652, name: box };
  const boxCandidates = [
    { id: 325652, name: box },
    { id: 11469, name: tenG },
    { id: 11434, name: g350 },
  ];
  const boxRes = filterVariantConflicts(boxSeed, boxCandidates, true);
  assert.deepEqual(boxRes.kept.map((c) => c.id), [325652]);
  assert.equal(boxRes.excludedCount, 2);
}

console.log("Variant guard tests passed.");
