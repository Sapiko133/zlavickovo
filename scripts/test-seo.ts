/**
 * Unit testy SEO vrstvy (čisté funkcie, bez siete).
 * Spustenie: npx tsx scripts/test-seo.ts
 */
import assert from "node:assert/strict";
import { absoluteUrl, cleanTitle, clampDescription, plural } from "../lib/seo/config.ts";
import { breadcrumbJsonLd, buildJsonLdGraph, itemListJsonLd, validateJsonLd, validateJsonLdNode } from "../lib/seo/jsonld.ts";
import {
  articleDedupeKey, articleLifecycle, categoryIndexDecision, duplicateArticleCanonicals,
  EXPIRED_OFFER_GRACE_DAYS, isShopOfferActive, shopIndexDecision,
} from "../lib/seo/indexing.ts";
import { resolveShopSlugSync, seoShopName, type ShopRegistry } from "../lib/seo/shop-registry.ts";
import { renderSitemapIndex, renderUrlset } from "../lib/seo/sitemap.ts";
import { parseHtml } from "../lib/seo/audit.ts";
import type { Article } from "../lib/articles.ts";

// ── config ──
assert.equal(absoluteUrl("/"), "https://www.zlavickovo.sk");
assert.equal(absoluteUrl("/kupony/alza/"), "https://www.zlavickovo.sk/kupony/alza");
assert.equal(cleanTitle("Akcie | Akcie | Zľavy | Zlavickovo"), "Akcie – Zľavy");
assert.ok(clampDescription("a ".repeat(200)).length <= 158);
assert.equal(plural(1, "kód", "kódy", "kódov"), "kód");
assert.equal(plural(3, "kód", "kódy", "kódov"), "kódy");
assert.equal(plural(5, "kód", "kódy", "kódov"), "kódov");
assert.equal(plural(0, "kód", "kódy", "kódov"), "kódov");

// ── mená obchodov ──
assert.equal(seoShopName("Bonprix.sk (for cashbacks)"), "Bonprix.sk");
assert.equal(seoShopName("CZ - Cropp.com"), "Cropp.com");
assert.equal(seoShopName("2sport CZ/SK"), "2sport");
assert.equal(seoShopName("Elmich CZ SK"), "Elmich");
assert.equal(seoShopName("Canatura.com/cz"), "Canatura.com CZ");
assert.equal(seoShopName("Lego.com/sk-sk"), "Lego.com");
assert.equal(seoShopName("ASKO-NABYTOK.SK"), "Asko-nabytok.sk");
assert.equal(seoShopName("Alza"), "Alza");

// ── register: aliasy, kompaktné kľúče, -cz/-sk varianty, neexistujúce ──
const entry = (slug: string, domain = "") => ({ slug, name: slug, domain, categoryId: null });
const reg: ShopRegistry = {
  bySlug: new Map([["about-you", entry("about-you", "aboutyou.sk")], ["dr-max", entry("dr-max")], ["hm", entry("hm")], ["elmich-cz", entry("elmich-cz")], ["bonprix", entry("bonprix")]]),
  aliases: new Map([["h-m", "hm"], ["bonprixsk-for-cashbacks", "bonprix"]]),
  byCompact: new Map([["aboutyou", "about-you"], ["drmax", "dr-max"], ["hm", "hm"], ["elmichcz", "elmich-cz"], ["bonprix", "bonprix"]]),
  byDomain: new Map([["aboutyou.sk", "about-you"]]),
};
assert.equal(resolveShopSlugSync(reg, { slug: "aboutyou" }), "about-you");
assert.equal(resolveShopSlugSync(reg, { slug: "drmax" }), "dr-max");
assert.equal(resolveShopSlugSync(reg, { slug: "h-m" }), "hm");
assert.equal(resolveShopSlugSync(reg, { slug: "elmich" }), "elmich-cz");
assert.equal(resolveShopSlugSync(reg, { slug: "bonprixsk-for-cashbacks" }), "bonprix");
assert.equal(resolveShopSlugSync(reg, { name: "About You" }), "about-you");
assert.equal(resolveShopSlugSync(reg, { domain: "www.aboutyou.sk" }), "about-you");
assert.equal(resolveShopSlugSync(reg, { slug: "siko" }), null, "obchod bez stránky → žiadny odkaz");

// ── indexačná politika ──
assert.equal(shopIndexDecision({ slug: "random", activeOffers: 0 }).index, false);
assert.equal(shopIndexDecision({ slug: "random", activeOffers: 2 }).index, true);
assert.equal(shopIndexDecision({ slug: "alza", activeOffers: 0 }).index, true, "TOP obchod ostáva indexovateľný");
assert.equal(shopIndexDecision({ slug: "alza", activeOffers: 5, isCzVariant: true }).index, false);
assert.equal(categoryIndexDecision({ shopCount: 2, activeOffers: 0 }).index, false);
assert.equal(categoryIndexDecision({ shopCount: 3, activeOffers: 0 }).index, true);
assert.equal(categoryIndexDecision({ shopCount: 1, activeOffers: 4 }).index, true);
assert.equal(isShopOfferActive({ valid_to: "2000-01-01" }), false);
assert.equal(isShopOfferActive({ validTo: null }), true);

// ── životný cyklus ponuky ──
const NOW = Date.parse("2026-09-24T10:00:00Z");
const art = (p: Partial<Article>): Article => ({
  slug: "x", type: "sale", title: "Alza.sk: Výpredaj", perex: "", date: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z", published: true, source: "auto", ...p,
});
assert.equal(articleLifecycle(art({ validTo: "2026-12-31" }), NOW).state, "active");
assert.equal(articleLifecycle(art({ validTo: null }), NOW).state, "active");
assert.equal(articleLifecycle(art({ validTo: "2026-09-20" }), NOW).state, "expired", "published, ale po platnosti");
assert.equal(articleLifecycle(art({ published: false, validTo: "2026-09-20" }), NOW).state, "expired");
const old = new Date(NOW - (EXPIRED_OFFER_GRACE_DAYS + 1) * 86400_000).toISOString();
assert.equal(articleLifecycle(art({ published: false, validTo: old }), NOW).state, "gone");
assert.equal(articleLifecycle(art({ type: "tip", published: true, validTo: old }), NOW).state, "active", "tip je evergreen");

// ── duplicitné ponuky → jedna canonical (najstaršia) ──
assert.equal(articleDedupeKey(art({ shopSlug: "tchibo", title: "Tchibo.sk: Ladies" })), articleDedupeKey(art({ shopSlug: "tchibo", title: "Tchibo: ladies" })));
{
  const a = art({ slug: "a", shopSlug: "tchibo", title: "Tchibo.sk: Ladies", date: "2026-09-02T00:00:00Z" });
  const b = art({ slug: "b", shopSlug: "tchibo", title: "Tchibo.sk: Ladies", date: "2026-09-01T00:00:00Z" });
  const c = art({ slug: "c", shopSlug: "tchibo", title: "Tchibo.sk: Men" });
  const m = duplicateArticleCanonicals([a, b, c]);
  assert.equal(m.get("a"), "b");
  assert.equal(m.has("b"), false);
  assert.equal(m.has("c"), false);
}

// ── JSON-LD ──
{
  const bc = breadcrumbJsonLd([{ name: "Domov", path: "/" }, { name: "Obchody", path: "/obchody" }, { name: "Alza" }]);
  assert.deepEqual(validateJsonLdNode(bc), []);
  assert.ok(validateJsonLdNode({ "@type": "BreadcrumbList", itemListElement: [{ position: 1, name: "", item: "/x" }] }).length > 0);
  assert.ok(validateJsonLdNode({ "@type": "Product", name: "x" }).some((e) => e.includes("nepovolený")));
  assert.ok(validateJsonLdNode({ "@type": "Article", headline: "x".repeat(120), datePublished: "2026-01-01", image: "a" }).some((e) => e.includes("110")));
  assert.equal(itemListJsonLd("x", []), null);
  const graph = buildJsonLdGraph([bc, { "@type": "Product", name: "fake" }, null]);
  assert.ok(graph && !graph.includes("Product"), "nevalidný uzol sa nevykreslí");
  assert.deepEqual(validateJsonLd(JSON.parse(graph!)).errors, []);
}

// ── sitemap XML ──
{
  const xml = renderUrlset([
    { url: "https://www.zlavickovo.sk/a?x=1&y=2" },
    { url: "https://www.zlavickovo.sk/a?x=1&y=2" },
    { url: "https://evil.example/x" },
  ]);
  assert.ok(xml.startsWith("<?xml"));
  assert.equal((xml.match(/<loc>/g) ?? []).length, 1, "dedupe + len vlastná doména");
  assert.ok(xml.includes("&amp;y=2"), "& je escapované");
  assert.ok(renderSitemapIndex().includes("sitemap-shops.xml"));
}

// ── audit parser ──
{
  const html = `<html><head><title>A &amp; B | Zlavickovo</title><meta name="description" content="d"><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://www.zlavickovo.sk/x"></head>
  <body><h1>Nadpis</h1><a href="/kupony/alza">x</a><a href="https://ext.sk" rel="nofollow">e</a><img src="a.png"><div data-active-offers="0" data-offer-status="expired"></div></body></html>`;
  const p = parseHtml(html, "https://www.zlavickovo.sk/x", "https://www.zlavickovo.sk");
  assert.equal(p.title, "A & B | Zlavickovo");
  assert.equal(p.indexable, false);
  assert.equal(p.canonical, "https://www.zlavickovo.sk/x");
  assert.deepEqual(p.h1, ["Nadpis"]);
  assert.deepEqual(p.internalLinks, ["/kupony/alza"]);
  assert.equal(p.imagesWithoutAlt, 1);
  assert.equal(p.activeOffers, 0);
  assert.equal(p.offerExpired, true);
}

console.log("test-seo: OK");
