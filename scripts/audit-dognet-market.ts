/**
 * Audit Dognet market filtra (Variant A — len SK/CZ trhy)
 *
 * Stiahne všetky kampane (pagination po 200) a kupóny priamo z Dognet API
 * a aplikuje rovnaký filter ako lib/dognet.ts (lib/dognet-market.ts):
 *   - kupóny: explicitné pole `countries`, fallback doménová heuristika
 *   - kampane: .sk/.cz TLD, prefix „SK -"/„CZ -", path /sk|/cs|/cs-cz…, subdoména sk./cz.
 *
 * Vypíše počty pred/po, rozpad vyradených podľa TLD/krajiny a príklady.
 *
 * Spustenie: npx tsx scripts/audit-dognet-market.ts
 */
import fs from "fs";
import path from "path";

// .env.local — splitovať /\r?\n/ (CRLF na Windows)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import { dognetCountriesAllowed, isAllowedDognetCoupon, isDognetSkCzMarket } from "../lib/dognet-market";

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;
const PER_PAGE = 200;
const MAX_PAGES = 10;

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.DOGNET_EMAIL, password: process.env.DOGNET_PASSWORD }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  const token = data.token || data.data?.token;
  if (!token) throw new Error("Dognet login zlyhal");
  return token;
}

async function fetchAllCampaigns(t: string): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${API_BASE}/campaigns/filter?page=${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ "per-page": PER_PAGE }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = Array.isArray(data?.data) ? data.data : [];
    items.push(...batch);
    const lastPage = Number(data?._meta?.last_page ?? data?.meta?.last_page ?? 0);
    if (batch.length < PER_PAGE || (lastPage > 0 && page >= lastPage)) break;
  }
  return items;
}

async function fetchCoupons(t: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/coupons/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      ad_channel_id: AD_CHANNEL_ID,
      from_joined_campaigns: true,
      filter: [{ validity: { eq: "present" } }],
      expand: "campaign",
      "per-page": 500,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return data.data || [];
}

// Skupina pre rozpad vyradených: TLD domény, príp. countries kód
function marketBucket(name: string | undefined, url: string | undefined): string {
  const cand = String(url ?? "").trim() || String(name ?? "").trim().split(/\s+/)[0] || "";
  try {
    const u = new URL(cand.includes("://") ? cand : `https://${cand}`);
    const labels = u.hostname.toLowerCase().split(".");
    return `.${labels[labels.length - 1]}`;
  } catch {
    return "(bez domény)";
  }
}

function fmtCampaign(c: any): string {
  return `${c.name} | url=${c.url ?? "-"}`;
}

function fmtCoupon(c: any): string {
  const countries = c.countries && typeof c.countries === "object"
    ? Object.values(c.countries).join(",") || "[]"
    : "-";
  const code = c.code ? `kód=${c.code}` : "bez kódu (akcia)";
  return `${c.campaign?.name ?? "?"} | countries=${countries} | ${code}`;
}

async function main() {
  const t = await login();
  const [campaigns, coupons] = await Promise.all([fetchAllCampaigns(t), fetchCoupons(t)]);

  // ── 1. Kampane (getShops / getAllKnownShops) ──
  const campaignsKept = campaigns.filter(c => isDognetSkCzMarket(c.name, c.url));
  const campaignsDropped = campaigns.filter(c => !isDognetSkCzMarket(c.name, c.url));

  console.log("Audit Dognet market filtra — Variant A (len SK/CZ)\n");
  console.log("── Kampane (obchody) ──");
  console.log(`  Kampaní pred filtrom:  ${campaigns.length}`);
  console.log(`  Kampaní po filtri:     ${campaignsKept.length}`);
  console.log(`  Vyradených:            ${campaignsDropped.length}`);

  const buckets = new Map<string, number>();
  for (const c of campaignsDropped) {
    const b = marketBucket(c.name, c.url);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  console.log("  Vyradené podľa TLD:");
  for (const [b, n] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${b}: ${n}`);
  }

  console.log("\n── 20 príkladov vyradených kampaní ──");
  for (const c of campaignsDropped.slice(0, 20)) console.log(`  ${fmtCampaign(c)}`);

  // Ponechané globálne domény (nie priamo .sk/.cz TLD) — dôkaz, že SK/CZ varianty prežili
  const keptGlobal = campaignsKept.filter(c => {
    const b = marketBucket(c.name, c.url);
    return b !== ".sk" && b !== ".cz";
  });
  console.log(`\n── Ponechané globálne SK/CZ domény (${keptGlobal.length}) — max 20 príkladov ──`);
  for (const c of keptGlobal.slice(0, 20)) console.log(`  ${fmtCampaign(c)}`);

  // ── 2. Kupóny (_fetchDognetCoupons) ──
  const couponsKept = coupons.filter(isAllowedDognetCoupon);
  const couponsDropped = coupons.filter((c: any) => !isAllowedDognetCoupon(c));

  const kupony = (arr: any[]) => arr.filter(c => c.code && String(c.code).trim() !== "").length;
  const akcie = (arr: any[]) => arr.length - kupony(arr);

  console.log("\n── Kupóny + akcie ──");
  console.log(`  Voucherov pred filtrom:  ${coupons.length} (kupónov ${kupony(coupons)}, akcií ${akcie(coupons)})`);
  console.log(`  Voucherov po filtri:     ${couponsKept.length} (kupónov ${kupony(couponsKept)}, akcií ${akcie(couponsKept)})`);
  console.log(`  Vyradených:              ${couponsDropped.length} (kupónov ${kupony(couponsDropped)}, akcií ${akcie(couponsDropped)})`);

  const cBuckets = new Map<string, number>();
  for (const c of couponsDropped) {
    const byCountries = dognetCountriesAllowed(c.countries);
    const b = byCountries !== null
      ? Object.values(c.countries).map(String).join(",")
      : marketBucket(c.campaign?.name, c.campaign?.url);
    cBuckets.set(b, (cBuckets.get(b) ?? 0) + 1);
  }
  console.log("  Vyradené podľa krajiny/TLD:");
  for (const [b, n] of [...cBuckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${b}: ${n}`);
  }

  console.log("\n── 20 príkladov vyradených voucherov ──");
  for (const c of couponsDropped.slice(0, 20)) console.log(`  ${fmtCoupon(c)}`);

  console.log("\n── 20 príkladov ponechaných voucherov ──");
  for (const c of couponsKept.slice(0, 20)) console.log(`  ${fmtCoupon(c)}`);
}

main().catch(err => {
  console.error("Audit zlyhal:", err);
  process.exit(1);
});
