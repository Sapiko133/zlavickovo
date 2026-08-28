import assert from "node:assert/strict";

// Deterministický Heureka fallback: haff sa číta lazily pri volaní, stačí ho
// nastaviť pred prvým resolveOfferOutbound.
process.env.HEUREKA_HAFF_ID = process.env.HEUREKA_HAFF_ID || "test-haff";

import { resolveOfferOutbound } from "../lib/offers/outbound.ts";

// 1. Priamy affiliate ponuky má prednosť pred všetkým ostatným.
{
  const out = resolveOfferOutbound({
    affiliateUrl: "https://go.dognet.sk/aff?x=1",
    shopAffiliateUrl: "https://shop.example/aff",
    url: "https://bonprix.sk/produkt",
    name: "Tričko",
  });
  assert.equal(out.url, "https://go.dognet.sk/aff?x=1");
  assert.equal(out.kind, "shop_affiliate");
  assert.equal(out.monetized, true);
}

// 2. Bez priameho affiliate vyhrá shop-level affiliate pred Heurekou.
{
  const out = resolveOfferOutbound({
    affiliateUrl: null,
    shopAffiliateUrl: "https://shop.example/aff",
    url: "https://bonprix.sk/produkt",
    name: "Tričko",
  });
  assert.equal(out.url, "https://shop.example/aff");
  assert.equal(out.monetized, true);
}

// 3. Bez affiliate (ponuka aj shop) sa použije Heureka fallback (haff je nastavené).
{
  const out = resolveOfferOutbound({ url: "https://bonprix.sk/produkt", name: "Tričko" });
  assert.equal(out.kind, "heureka_fallback");
  assert.equal(out.monetized, true);
}

// Neplatné URL sa ignorujú a spadne to na ďalší krok priority.
{
  const out = resolveOfferOutbound({
    affiliateUrl: "javascript:alert(1)",
    shopAffiliateUrl: "not-a-url",
    url: "https://bonprix.sk/p",
    name: "X",
  });
  assert.equal(out.kind, "heureka_fallback"); // haff nastavené → fallback pred direct
}

console.log("Offer outbound resolver tests passed.");
