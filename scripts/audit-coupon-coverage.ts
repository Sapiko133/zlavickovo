/**
 * Audit pokrytia kupónov — prečo shop stránky zobrazujú málo kupónov/akcií.
 *
 * Pre 20 najväčších obchodov meria pipeline kupónov po zdrojoch (Dognet / eHub /
 * CJ / Affial) a kde sa položky strácajú:
 *   - nespárované (name/domain matcher)
 *   - mimo SK/CZ (market filter)
 *   - expirované (validity)
 *   - nejoined / neschválené (from_joined_campaigns, eHub approval)
 *
 * Fáza 1 (cache): reálne zobrazené počty = presná replika getCouponsByShop().
 * Fáza 2 (Dognet raw, best-effort): joined=false katalóg vs joined=true.
 * Fáza 3 (eHub raw, best-effort): lievik total→valid→market→approved.
 *
 * Read-only. Spustenie: npx tsx scripts/audit-coupon-coverage.ts
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

// 20 najväčších SK/CZ obchodov (slug = /kupony/[slug]); shopName = slug s medzerami (ako page.tsx)
const SHOPS: { slug: string; label: string }[] = [
  { slug: "alza", label: "Alza" },
  { slug: "notino", label: "Notino" },
  { slug: "gymbeam", label: "GymBeam" },
  { slug: "dr-max", label: "Dr.Max" },
  { slug: "datart", label: "Datart" },
  { slug: "nay", label: "Nay" },
  { slug: "about-you", label: "About You" },
  { slug: "mall", label: "Mall" },
  { slug: "sportisimo", label: "Sportisimo" },
  { slug: "dedoles", label: "Dedoles" },
  { slug: "martinus", label: "Martinus" },
  { slug: "zalando", label: "Zalando" },
  { slug: "answear", label: "Answear" },
  { slug: "decathlon", label: "Decathlon" },
  { slug: "shein", label: "Shein" },
  { slug: "bonprix", label: "Bonprix" },
  { slug: "hej", label: "Hej.sk" },
  { slug: "lidl", label: "Lidl" },
  { slug: "ikea", label: "Ikea" },
  { slug: "eobuv", label: "eobuv" },
];

async function main() {
  const { getCoupons, getCouponsByShop } = await import("../lib/dognet");
  const { getEhubCoupons, getCampaignMarket, isAllowedMarket, isApprovedCampaign } = await import("../lib/ehub");
  const { getCjCoupons } = await import("../lib/cj");
  const { createShopMatcher } = await import("../lib/shop-match");
  const { isAllowedDognetCoupon } = await import("../lib/dognet-market");
  const { AFFIAL_COUPONS } = await import("../lib/affial-coupons");
  const { STATIC_AKCIE } = await import("../lib/akcie");
  const { cleanDognetShopName } = await import("../lib/shop-name");

  let affialXml: any[] = [];
  try { affialXml = await (await import("../lib/affial")).getAffialCoupons(); } catch { affialXml = []; }

  // ── Načítanie cachovaných poolov ──
  const [dognet, ehub, cjAll] = await Promise.all([
    getCoupons().catch(() => []),
    getEhubCoupons().catch(() => []),
    getCjCoupons().catch(() => []),
  ]);

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(" POOL (cache) po našich filtroch — koľko položiek vôbec máme k dispozícii");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Dognet (joined + SK/CZ + present):        ${dognet.length}`);
  console.log(`  eHub   (approved + SK/CZ + valid):        ${ehub.length}`);
  console.log(`  CJ     (joined advertisers, non-expired): ${cjAll.length}`);
  console.log(`  Affial XML feed:                          ${affialXml.length}`);
  console.log(`  AFFIAL_COUPONS (statické):                ${AFFIAL_COUPONS.length}`);
  console.log(`  STATIC_AKCIE:                             ${STATIC_AKCIE.length}`);

  // ── Fáza 1: per-shop, replika getCouponsByShop ──
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(" FÁZA 1 — reálne zobrazené počty (per source) + kód/akcia split");
  console.log("═══════════════════════════════════════════════════════════════════");
  const header = ["SHOP", "Dgnt", "eHub", "CJ", "AflX", "AflS", "Akc", "→KÓD", "→AKC", "SPOLU"];
  console.log(header.map((h, i) => i === 0 ? h.padEnd(12) : h.padStart(6)).join(" "));

  const rows: any[] = [];
  for (const shop of SHOPS) {
    const shopName = shop.slug.replace(/-/g, " ");
    const matches = createShopMatcher(shopName);

    const dMatch = dognet.filter((c: any) => matches(c.campaign?.name, c.campaign?.url ?? c.campaign?.website_url));
    const eMatch = ehub.filter((c: any) => matches(c.campaign_name));
    // CJ matcher v appke je naivný includes(shopName) — replikujeme presne
    const cjMatch = cjAll.filter((c: any) => c.advertiserName?.toLowerCase().includes(shopName.toLowerCase()));
    const axMatch = affialXml.filter((c: any) => matches(c.campaign_name, c.campaign_name));
    const asMatch = AFFIAL_COUPONS.filter((c: any) => matches(c.shop, c.domain));
    const akMatch = STATIC_AKCIE.filter((a: any) => matches(a.shopName, a.domain));

    // Reálny výstup + kód/akcia split
    let displayed: any[] = [];
    try { displayed = await getCouponsByShop(shopName); } catch {}
    const code = displayed.filter((c: any) => c.code && c.code.trim() !== "").length;
    const deal = displayed.length - code;

    rows.push({
      shop, shopName,
      d: dMatch.length, e: eMatch.length, cj: cjMatch.length,
      ax: axMatch.length, as: asMatch.length, ak: akMatch.length,
      code, deal, total: displayed.length,
      cjNames: [...new Set(cjMatch.map((c: any) => c.advertiserName))],
    });

    console.log([
      shop.label.padEnd(12),
      String(dMatch.length).padStart(6),
      String(eMatch.length).padStart(6),
      String(cjMatch.length).padStart(6),
      String(axMatch.length).padStart(6),
      String(asMatch.length).padStart(6),
      String(akMatch.length).padStart(6),
      String(code).padStart(6),
      String(deal).padStart(6),
      String(displayed.length).padStart(6),
    ].join(" "));
  }

  // ── Fáza 2: Dognet raw katalóg (joined=false) vs joined ──
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(" FÁZA 2 — Dognet katalóg (joined=false) vs čo reálne máme (joined=true)");
  console.log("  = koľko kupónov pre daný obchod EXISTUJE v Dognete, ale nie sme joined");
  console.log("═══════════════════════════════════════════════════════════════════");
  try {
    const { getToken } = await import("../lib/dognet");
    const t = await getToken();
    const fetchRaw = async (joined: boolean) => {
      const res = await fetch("https://api.app.dognet.com/api/v1/coupons/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          ad_channel_id: 33415,
          from_joined_campaigns: joined,
          filter: [{ validity: { eq: "present" } }],
          expand: "campaign",
          "per-page": 500,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return (data.data || []).map((c: any) => ({
        ...c,
        campaign: c.campaign?.name ? { ...c.campaign, name: cleanDognetShopName(c.campaign.name) } : c.campaign,
      }));
    };
    const [catalogAll, joinedAll] = await Promise.all([fetchRaw(false), fetchRaw(true)]);
    const catalogSkCz = catalogAll.filter(isAllowedDognetCoupon);
    console.log(`  Katalóg spolu (joined=false, present):  ${catalogAll.length}${catalogAll.length >= 500 ? " ⚠ možný strop 500" : ""}`);
    console.log(`  Katalóg po SK/CZ market filtri:         ${catalogSkCz.length}  (mimo SK/CZ: ${catalogAll.length - catalogSkCz.length})`);
    console.log(`  Joined (present):                       ${joinedAll.length}`);
    console.log("");
    console.log(`  ${"SHOP".padEnd(12)} ${"katalóg".padStart(8)} ${"joined".padStart(8)} ${"strata".padStart(8)}  dôvod`);
    for (const shop of SHOPS) {
      const matches = createShopMatcher(shop.slug.replace(/-/g, " "));
      const inCat = catalogAll.filter((c: any) => matches(c.campaign?.name, c.campaign?.url)).length;
      const inCatSk = catalogSkCz.filter((c: any) => matches(c.campaign?.name, c.campaign?.url)).length;
      const inJoined = joinedAll.filter((c: any) => matches(c.campaign?.name, c.campaign?.url)).length;
      const reason = inCat === 0 ? "obchod nie je v Dognet katalógu"
        : inJoined === 0 ? "NIE sme joined (kampaň neschválená)"
        : inCatSk > inJoined ? "časť mimo SK/CZ" : "OK";
      console.log(`  ${shop.label.padEnd(12)} ${String(inCat).padStart(8)} ${String(inJoined).padStart(8)} ${String(Math.max(0, inCat - inJoined)).padStart(8)}  ${reason}`);
    }
  } catch (e) {
    console.log(`  ⚠ Dognet raw fetch zlyhal (${(e as Error).message}) — preskočené.`);
  }

  // ── Fáza 3: eHub raw lievik ──
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(" FÁZA 3 — eHub lievik: total → valid → SK/CZ → approved");
  console.log("═══════════════════════════════════════════════════════════════════");
  try {
    const partnerId = process.env.EHUB_PARTNER_ID ?? "";
    const apiKey = process.env.EHUB_API_KEY ?? "";
    const fetchAll = async (p: string, key: string) => {
      const items: any[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await fetch(`https://api.ehub.cz/v3/publishers/${partnerId}/${p}?apiKey=${apiKey}&page=${page}&perPage=100`, {
          headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) break;
        const data = await res.json();
        const batch = Array.isArray(data?.[key]) ? data[key] : [];
        items.push(...batch);
        const total = Number(data?.totalItems ?? 0);
        if (batch.length < 100 || (total > 0 && items.length >= total)) break;
      }
      return items;
    };
    const [vouchers, campaigns] = await Promise.all([fetchAll("vouchers", "vouchers"), fetchAll("campaigns", "campaigns")]);
    const marketById = new Map<string, string>();
    const approvedIds = new Set<string>();
    for (const c of campaigns) {
      marketById.set(String(c.id ?? ""), getCampaignMarket(c));
      if (isApprovedCampaign(c)) approvedIds.add(String(c.id ?? ""));
    }
    const today = new Date().toISOString().slice(0, 10);
    const dateOk = (v: any) => (!v.validFrom || String(v.validFrom).slice(0, 10) <= today) && (!v.validTill || String(v.validTill).slice(0, 10) >= today);
    const nValid = vouchers.filter((v: any) => v.isValid === true && dateOk(v)).length;
    const nMarket = vouchers.filter((v: any) => v.isValid === true && dateOk(v) && isAllowedMarket(marketById.get(String(v.campaignId ?? "")))).length;
    const nApproved = vouchers.filter((v: any) => v.isValid === true && dateOk(v) && isAllowedMarket(marketById.get(String(v.campaignId ?? ""))) && approvedIds.has(String(v.campaignId ?? ""))).length;
    console.log(`  Vouchery spolu:                 ${vouchers.length}`);
    console.log(`  → valid + v dátume:             ${nValid}  (expired/invalid: ${vouchers.length - nValid})`);
    console.log(`  → SK/CZ market:                 ${nMarket}  (mimo SK/CZ: ${nValid - nMarket})`);
    console.log(`  → approved (zobrazíme):         ${nApproved}  (neschválené: ${nMarket - nApproved})`);
    console.log(`  Kampane spolu: ${campaigns.length}, approved: ${approvedIds.size}`);
  } catch (e) {
    console.log(`  ⚠ eHub raw fetch zlyhal (${(e as Error).message}) — preskočené.`);
  }

  // ── Zhrnutie 10 najväčších strát ──
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(" CJ párovanie — obchody kde naivný includes() zlyhá");
  console.log("═══════════════════════════════════════════════════════════════════");
  for (const r of rows) {
    if (r.cj === 0) console.log(`  ${r.shop.label.padEnd(12)} shopName="${r.shopName}" → CJ 0 zhôd (skontroluj advertiserName)`);
  }

  console.log("\nHotovo.");
}

main().catch(e => { console.error(e); process.exit(1); });
