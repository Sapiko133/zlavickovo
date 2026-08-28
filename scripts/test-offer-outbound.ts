import assert from "node:assert/strict";
import { resolveOfferOutbound } from "../lib/offers/outbound.ts";

// 1. Priamy affiliate ponuky má prednosť pred všetkým ostatným.
{
  const out = resolveOfferOutbound({
    affiliateUrl: "https://go.dognet.sk/aff?x=1",
    shopAffiliateUrl: "https://shop.example/aff",
    url: "https://bonprix.sk/produkt",
  });
  assert.equal(out?.url, "https://go.dognet.sk/aff?x=1");
  assert.equal(out?.kind, "shop_affiliate");
  assert.equal(out?.monetized, true);
}

// 2. Bez priameho affiliate vyhrá shop-level affiliate.
{
  const out = resolveOfferOutbound({
    affiliateUrl: null,
    shopAffiliateUrl: "https://shop.example/aff",
    url: "https://bonprix.sk/produkt",
  });
  assert.equal(out?.url, "https://shop.example/aff");
  assert.equal(out?.monetized, true);
}

// 3. Bez affiliate ostáva neplatený priamy odkaz (ŽIADNY Heureka fallback).
{
  const out = resolveOfferOutbound({ url: "https://bonprix.sk/produkt" });
  assert.equal(out?.kind, "direct_unmonetized");
  assert.equal(out?.monetized, false);
}

// Neplatné URL sa ignorujú; bez akéhokoľvek platného odkazu => null.
{
  assert.equal(resolveOfferOutbound({ affiliateUrl: "javascript:alert(1)", shopAffiliateUrl: "not-a-url" }), null);
  const out = resolveOfferOutbound({ affiliateUrl: "javascript:alert(1)", url: "https://bonprix.sk/p" });
  assert.equal(out?.kind, "direct_unmonetized");
}

console.log("Offer outbound resolver tests passed.");
