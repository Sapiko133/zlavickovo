/**
 * Test mapovania feed slug → doména (shop stránky pre feed shopy, §18).
 * Spustenie: npx tsx scripts/test-feed-shop-slug.ts
 */
import assert from "node:assert/strict";
import { feedShopDomainForSlug } from "../lib/heureka/feed-shop-slug.ts";
import { variantBaseKey } from "../lib/heureka/variant-name.ts";

// variantBaseKey: EU/EUR obuv veľkosti na konci sa zlúčia
assert.equal(
  variantBaseKey("ARNO 505 farebné dievčenské papučky EUR 20.5"),
  variantBaseKey("ARNO 505 farebné dievčenské papučky EUR 21")
);
// dievčenské vs chlapčenské sa NEzlúčia
assert.notEqual(
  variantBaseKey("ARNO 505 farebné dievčenské papučky EUR 21"),
  variantBaseKey("ARNO 505 farebné chlapčenské papučky EUR 21")
);
// "EU 42" tiež
assert.equal(variantBaseKey("Hoka obuv Clifton EU 42"), variantBaseKey("Hoka obuv Clifton EU 44"));
// model číslo (bez EUR/EU prefixu) sa NEstripne
assert.notEqual(variantBaseKey("iPhone 15"), variantBaseKey("iPhone 16"));

// .cz-only shop → base slug vedie na .cz doménu
assert.equal(feedShopDomainForSlug("tokrahome"), "tokrahome.cz");
assert.equal(feedShopDomainForSlug("arno"), "arno.cz");
assert.equal(feedShopDomainForSlug("zdravibezchemie"), "zdravibezchemie.cz");

// .sk/.cz súrodenci: base = .sk, base-cz = .cz
assert.equal(feedShopDomainForSlug("kolagendrink"), "kolagendrink.sk");
assert.equal(feedShopDomainForSlug("kolagendrink-cz"), "kolagendrink.cz");
assert.equal(feedShopDomainForSlug("milenialcafe"), "milenialcafe.sk");
assert.equal(feedShopDomainForSlug("milenialcafe-cz"), "milenialcafe.cz");

// .sk-only shop
assert.equal(feedShopDomainForSlug("izerex"), "izerex.sk");

// case-insensitive
assert.equal(feedShopDomainForSlug("Tokrahome"), "tokrahome.cz");

// neexistujúci slug → null
assert.equal(feedShopDomainForSlug("nonexistentshop123"), null);

console.log("Feed shop slug tests passed.");
