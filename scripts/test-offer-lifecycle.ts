/**
 * Offer lifecycle akčných článkov — grace perióda, zdravie providera,
 * expirácia podľa dátumu, text/URL normalizácia (data quality).
 * Spustenie: npx tsx scripts/test-offer-lifecycle.ts
 */
import assert from "node:assert/strict";
import { ACTION_MISSING_GRACE_HOURS, decideMissingAction, providerHealthFromMeta, providerOfArticle } from "../lib/sale-articles.ts";
import { articleLifecycle, isArticleIndexable } from "../lib/seo/indexing.ts";
import { cleanFeedText, offerTitle, MAX_OFFER_TITLE } from "../lib/offers/text.ts";
import { canonicalOfferUrl, destinationOf, isTrackedAffiliateUrl, normalizeOfferUrl } from "../lib/offers/url.ts";
import type { FeedMeta } from "../lib/feeds/engine.ts";

const H = 3600_000;
const now = Date.parse("2026-09-24T10:00:00Z");

function main() {
  // ── Lifecycle rozhodnutia ──
  // Akcia s dátumom v minulosti = expired okamžite (dátum je autoritatívny).
  assert.deepEqual(decideMissingAction({ validTo: "2026-09-20", missingSince: null }, true, now), { action: "deactivate", reason: "expired" });
  // Provider v chybe → akcia sa NIKDY nedeaktivuje kvôli "zmiznutiu".
  assert.equal(decideMissingAction({ validTo: null, missingSince: null }, false, now).action, "keep");
  assert.equal(decideMissingAction({ validTo: null, missingSince: new Date(now - 100 * H).toISOString() }, false, now).action, "keep");
  // Prvé zmiznutie z validného feedu → stale (článok ostáva publikovaný).
  const first = decideMissingAction({ validTo: null, missingSince: null }, true, now);
  assert.equal(first.action, "mark_stale");
  // V grace perióde → keep.
  assert.equal(decideMissingAction({ validTo: null, missingSince: new Date(now - 5 * H).toISOString() }, true, now).action, "keep");
  // Po grace perióde → deactivate (missing).
  assert.deepEqual(
    decideMissingAction({ validTo: null, missingSince: new Date(now - (ACTION_MISSING_GRACE_HOURS + 1) * H).toISOString() }, true, now),
    { action: "deactivate", reason: "missing" },
  );

  // ── Zdravie providera z metadát feed enginu ──
  const ok = (id: string, lastSuccessAt: string, status: FeedMeta["status"] = "ok") => ({ id, status, lastSuccessAt } as FeedMeta);
  const health = providerHealthFromMeta({
    "dognet-coupons": ok("dognet-coupons", new Date(now - 2 * H).toISOString()),
    "ehub-vouchers": ok("ehub-vouchers", new Date(now - 2 * H).toISOString(), "error"),
    "cj-coupons": ok("cj-coupons", new Date(now - 72 * H).toISOString()),
  }, now);
  assert.equal(health.dognet, true);
  assert.equal(health.ehub, false, "feed v chybe = nezdravý");
  assert.equal(health.cj, false, "starý posledný úspech = nezdravý");
  assert.equal(health.affial, false, "bez metadát = nezdravý (bezpečný default)");
  assert.equal(health.static, true);
  assert.equal(providerOfArticle({ actionKey: "dognet:123" }), "dognet");
  assert.equal(providerOfArticle({ actionKey: undefined }), null);

  // ── Stale článok ostáva indexovateľný (SEO lifecycle sa nemení počas grace) ──
  const staleArticle = { type: "sale" as const, published: true, validTo: null, updatedAt: "2026-09-20T00:00:00Z" };
  assert.equal(isArticleIndexable(staleArticle), true);
  assert.equal(articleLifecycle({ ...staleArticle, published: false, updatedAt: new Date(now - 2 * H).toISOString() }, now).state, "expired");

  // ── Data quality: text z feedu ──
  assert.equal(cleanFeedText("Dárek (pexeso) při nákupu nad 1500 Kč \n"), "Dárek (pexeso) při nákupu nad 1500 Kč");
  assert.equal(cleanFeedText("Zaregistrujete sa  a <b>ušetríte</b> &amp; viac&nbsp;!"), "Zaregistrujete sa a ušetríte & viac !");
  assert.equal(cleanFeedText(null), "");
  const para = "Own the look!\n\nDobrý outfit sa začína správnymi voľbami. Preto teraz máte v Sizeer online až -20 % na vybrané produkty za min. 60 € s kódom EXTRA. Nezabudnite ani na dopravu zadarmo od 80 €.";
  const t = offerTitle(para);
  assert.ok(t.length <= MAX_OFFER_TITLE, `titulok skrátený (${t.length})`);
  assert.ok(/-20 %/.test(t), `vyberie informatívnu vetu so zľavou: ${t}`);
  assert.equal(offerTitle("Sleva 40% na všechno."), "Sleva 40% na všechno.", "krátky titulok sa nemení");

  // ── URL: kanonická identita vs. affiliate odkaz ──
  const dognet = "https://go.dognet.com/?chid=cl69TA2C&url=https%3A%2F%2Fwww.feelpearls.cz%2Fakce%2F%3Futm_source%3Dx%23top";
  assert.equal(isTrackedAffiliateUrl(dognet), true);
  assert.equal(destinationOf(dognet), "https://www.feelpearls.cz/akce/?utm_source=x#top");
  assert.equal(canonicalOfferUrl(dognet), "https://feelpearls.cz/akce", "UTM, fragment, www a lomítko preč");
  const ehub = "https://ehub.cz/system/scripts/click.php?a_aid=85c7b80f&a_bid=2bcd6f9d&desturl=https%3A%2F%2Fwww.iphonemarket.cz%2F";
  assert.equal(destinationOf(ehub), "https://www.iphonemarket.cz/");
  assert.equal(destinationOf("https://www.anrdoezrs.net/click-101812521-17310669-1782313361000"), null, "CJ bez cieľa sa nevolá (klik by sa započítal)");
  assert.equal(isTrackedAffiliateUrl("https://www.zoot.sk/vypredaj"), false, "priamy odkaz nie je monetizovaný");
  assert.equal(destinationOf("https://www.zoot.sk/vypredaj"), "https://www.zoot.sk/vypredaj");
  assert.equal(normalizeOfferUrl("HTTPS://WWW.Alza.sk/akcie/?b=2&a=1&fbclid=xyz&utm_medium=m"), "https://alza.sk/akcie?a=1&b=2");
  assert.equal(normalizeOfferUrl("https://alza.sk/"), "https://alza.sk");
  // Affiliate URL sa normalizáciou nemení (odlišná entita).
  assert.equal(dognet.includes("chid=cl69TA2C"), true);

  console.log("Offer lifecycle tests passed.");
}

main();
