/**
 * Audit affiliate pokrytia — pre kľúčové obchody porovná, či sa „Prejsť do obchodu"
 * odkaz vyrieši na affiliate tracking URL (Po) oproti pôvodnému priamemu odkazu (Pred).
 *
 * Používa ČERSTVÉ dáta z API (nie Redis cache), aby výsledok nezávisel od stavu cache
 * (lokálny Redis token je read-only). Preto zrkadlí logiku resolverov ručne nad fresh dátami.
 *
 * Spustenie: npx tsx scripts/audit-affiliate-coverage.ts
 */
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;

async function main() {
  const { createShopMatcher } = await import("../lib/shop-match");
  const { buildDognetTrackingUrl } = await import("../lib/dognet");
  const { AFFIAL_SHOPS, buildAffialTrackingUrl } = await import("../lib/affial-shops");
  const { isDognetSkCzMarket, isAllowedDognetCoupon } = await import("../lib/dognet-market");
  const { cleanDognetShopName } = await import("../lib/shop-name");

  // ── Dognet (fresh) ──
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.DOGNET_EMAIL, password: process.env.DOGNET_PASSWORD }),
  });
  const t = (await loginRes.json()).token;
  const cRes = await fetch(`${API_BASE}/coupons/filter`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ ad_channel_id: AD_CHANNEL_ID, from_joined_campaigns: true, filter: [{ validity: { eq: "present" } }], expand: "campaign", "per-page": 500 }),
  });
  const rawCoupons: any[] = (await cRes.json()).data || [];
  const chid = (() => {
    for (const c of rawCoupons) { const m = String(c?.url ?? "").match(/[?&]chid=([^&]+)/); if (m) return decodeURIComponent(m[1]); }
    return "cl69TA2C";
  })();
  // aplikuj rovnakú konštrukciu ako _fetchDognetCoupons
  const dognetCoupons = rawCoupons.filter(isAllowedDognetCoupon).map((c) => {
    const resolvedUrl = c.url || buildDognetTrackingUrl(chid, c.campaign?.url);
    return { ...c, source: "dognet", affiliate_link: resolvedUrl || "#", url: resolvedUrl || c.url, campaign: c.campaign };
  });

  // joined campaigns (fresh)
  let allCamps: any[] = [];
  for (let p = 1; p <= 10; p++) {
    const r = await fetch(`${API_BASE}/campaigns/filter?page=${p}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ "per-page": 200 }) });
    if (!r.ok) break; const d = await r.json(); const b = d.data || []; allCamps.push(...b); if (b.length < 200) break;
  }
  const joinedCampaigns = allCamps
    .filter((c) => (c.ad_channels_in_campaign || []).some((a: any) => a.ad_channel_id === AD_CHANNEL_ID && a.status === 1))
    .filter((c) => c.url && String(c.url).startsWith("http") && isDognetSkCzMarket(c.name, c.url))
    .map((c) => ({ name: cleanDognetShopName(c.name), url: c.url }));

  // ── CJ (fresh, joined) — coupon-type aj shop-level (any link) ──
  const cjFetch = async (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ "website-id": process.env.CJ_WEBSITE_ID!, "advertiser-ids": "joined", "records-per-page": "100", ...extra });
    return (await fetch(`https://link-search.api.cj.com/v2/link-search?${qs}`, { headers: { Authorization: `Bearer ${process.env.CJ_API_KEY}` }, signal: AbortSignal.timeout(30000) })).text();
  };
  const cjLink = (l: string) => (l.match(/<clickUrl>(.*?)<\/clickUrl>/)?.[1] || l.match(/<destination>(.*?)<\/destination>/)?.[1]) ?? "";
  const cjName = (l: string) => l.match(/<advertiser-name>(.*?)<\/advertiser-name>/)?.[1] ?? "";
  const cjCoupons = [...(await cjFetch({ "promotion-type": "Coupon" })).matchAll(/<link>([\s\S]*?)<\/link>/g)]
    .map((m) => m[1]).map((l) => ({ source: "cj", advertiserName: cjName(l), affiliate_link: cjLink(l) })).filter((c) => c.affiliate_link);
  // shop-level: prvý link na advertisera (any type)
  const cjShopMap = new Map<string, string>();
  for (const m of (await cjFetch({})).matchAll(/<link>([\s\S]*?)<\/link>/g)) {
    const l = m[1], name = cjName(l), url = cjLink(l);
    if (name && url && !cjShopMap.has(name)) cjShopMap.set(name, url);
  }

  // ── Affial (fresh) ──
  const affialXml = await (await fetch("https://www.affial.com/kupony_feed.xml")).text();
  const affialByDomain = new Map(AFFIAL_SHOPS.map((s) => [s.domain.toLowerCase(), s.affiliateUrl]));
  const affialCoupons = [...affialXml.matchAll(/<coupon>([\s\S]*?)<\/coupon>/g)].map((m) => m[1]).map((b) => {
    const offer = (b.match(/<offerName>(.*?)<\/offerName>/)?.[1] ?? "").toLowerCase();
    const url = b.match(/<url>(.*?)<\/url>/)?.[1] ?? "";
    const tracked = affialByDomain.get(offer) ?? (url.startsWith("http") ? buildAffialTrackingUrl(url) : "#");
    return { source: "affial", offer, feedUrl: url, affiliate_link: tracked };
  });

  const couponLink = (c: any) => (typeof c?.affiliate_link === "string" && c.affiliate_link.startsWith("http")) ? c.affiliate_link : (typeof c?.url === "string" && c.url.startsWith("http")) ? c.url : "";

  // NEW resolver — presné poradie: affiliateUrlFromCoupons (Dognet→CJ→eHub→Affial coupon)
  // → getShopAffiliateUrl (Affial shop → eHub → CJ shop → Dognet kampaň).
  function resolvePo(shop: string): { url: string; via: string } {
    const matches = createShopMatcher(shop);
    const dg = dognetCoupons.find((c) => matches(c.campaign?.name, c.campaign?.url) && couponLink(c).includes("go.dognet.com"));
    if (dg) return { url: couponLink(dg), via: "Dognet voucher" };
    const cjC = cjCoupons.find((c) => matches(c.advertiserName, c.advertiserName) && couponLink(c));
    if (cjC) return { url: couponLink(cjC), via: "CJ kupón" };
    const af = affialCoupons.find((c) => matches(c.offer, c.offer) && couponLink(c).includes("affial"));
    if (af) return { url: couponLink(af), via: "Affial kupón" };
    const afShop = AFFIAL_SHOPS.find((s) => matches(s.name, s.domain));
    if (afShop?.affiliateUrl?.startsWith("http")) return { url: afShop.affiliateUrl, via: "Affial shop" };
    const cjShop = [...cjShopMap.entries()].find(([name]) => matches(name, name));
    if (cjShop) return { url: cjShop[1], via: "CJ shop" };
    const jc = joinedCampaigns.find((c) => matches(c.name, c.url));
    if (jc) return { url: buildDognetTrackingUrl(chid, jc.url)!, via: "Dognet kampaň (bez voucherov)" };
    return { url: "", via: "" };
  }

  // OLD resolver — Dognet voucher s reálnou url (Bonprix mal url=null → '#'), bez CJ,
  // bez joined kampaní, Affial coupon fallback bol priamy (netrackovaný), bez 6 nových shopov.
  const oldAffial = AFFIAL_SHOPS.filter((s) => !["namaximum.sk","remoska.sk","mebik.sk","matchaday.sk","hairburst.sk","neohack.sk"].includes(s.domain));
  function resolvePred(shop: string): { url: string; via: string } {
    const matches = createShopMatcher(shop);
    const dg = rawCoupons.find((c) => matches(c.campaign?.name, c.campaign?.url) && String(c.url ?? "").includes("go.dognet.com"));
    if (dg) return { url: dg.url, via: "Dognet voucher" };
    const afShop = oldAffial.find((s) => matches(s.name, s.domain));
    if (afShop?.affiliateUrl?.startsWith("http")) return { url: afShop.affiliateUrl, via: "Affial shop" };
    // starý affial coupon fallback = priama feed url (netrackovaná)
    const af = affialCoupons.find((c) => matches(c.offer, c.offer));
    if (af?.feedUrl) return { url: af.feedUrl, via: "Affial priamy (netrackovaný)" };
    return { url: "", via: "" };
  }

  const shops = ["Bonprix", "Answear", "GymBeam", "Decathlon", "Namaximum", "Remoska", "Mebik", "Matchaday", "Hairburst", "Neohack"];
  const isTracked = (u: string) => /go\.dognet\.com|affial\.com|tkqlhce|dpbolvw|anrdoezrs|jdoqocy|kqzyfj|ehub\.cz|cj\.com|click-\d/.test(u);

  console.log("\n=== AUDIT AFFILIATE POKRYTIA ===");
  console.log("chid =", chid, "| joined kampaní (status1, SK/CZ):", joinedCampaigns.length, "| Affial shopov:", AFFIAL_SHOPS.length, "\n");
  console.log("Obchod".padEnd(11), "| Pred", "| Po (via)", "| Tracking OK?");
  for (const s of shops) {
    const pred = resolvePred(s);
    const po = resolvePo(s);
    const predShort = pred.url ? (isTracked(pred.url) ? "tracked" : "DIRECT") : "DIRECT (žiadny)";
    const ok = po.url && isTracked(po.url) ? "ÁNO" : "NIE";
    console.log(s.padEnd(11), "|", predShort.padEnd(15), "|", (po.via || "—").padEnd(30), "|", ok);
    console.log("   Po URL:", po.url.slice(0, 110) || "(žiadna)");
  }
}
main().catch((e) => { console.error("Audit zlyhal:", e); process.exit(1); });
