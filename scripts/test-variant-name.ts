/**
 * Testy zlučovacieho kľúča veľkostných variantov.
 * Spustenie: npx tsx scripts/test-variant-name.ts
 */
import assert from "node:assert/strict";
import { variantBaseKey } from "../lib/heureka/variant-name.ts";

// veľkosti sa zlúčia
assert.equal(
  variantBaseKey("Hoka Clifton 11 M frost Veľkosť EU: 42"),
  variantBaseKey("Hoka Clifton 11 M frost Veľkosť EU: 44")
);
assert.equal(
  variantBaseKey("Mammut Girun II Low GTX M black Velikost: 8.5"),
  variantBaseKey("Mammut Girun II Low GTX M black Velikost: 11.5")
);
// pán vs dáma sa NEzlúčia
assert.notEqual(
  variantBaseKey("ON obuv Advantage M white Veľkosť EU: 42"),
  variantBaseKey("ON obuv Advantage W white Veľkosť EU: 38")
);
// rozdielne modely sa NEzlúčia
assert.notEqual(
  variantBaseKey("iPhone 15 128GB"),
  variantBaseKey("iPhone 16 128GB")
);
// bez veľkosti = identita zostáva
assert.equal(variantBaseKey("Toko Care Duo Pack"), "toko care duo pack");
// prázdny vstup
assert.equal(variantBaseKey(""), "");

console.log("Variant name tests passed.");
