/**
 * Audit eHub validity + market filtra
 *   Platný voucher = isValid === true
 *                  && (validFrom <= dnes, ak existuje)
 *                  && (validTill >= dnes, ak existuje)
 *   Market filter = kampaň s marketom SK alebo CZ
 *                   (country z API; pri "other" fallback na TLD domény webu)
 *   Voucher prejde market filtrom len ak jeho campaignId patrí SK/CZ kampani.
 *
 * Stiahne všetky vouchery a kampane priamo z eHub API (rovnaká pagination ako
 * lib/ehub.ts) a vypíše počty pred/po filtroch + príklady.
 *
 * Spustenie: npx tsx scripts/audit-ehub-validity.ts
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

const BASE = "https://api.ehub.cz/v3";
const PER_PAGE = 100;
const MAX_PAGES = 50;
const ALLOWED_MARKETS = new Set(["SK", "CZ"]);

function isDateRangeActive(validFrom: string | null | undefined, validTill: string | null | undefined): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (validFrom && String(validFrom).slice(0, 10) > today) return false;
  if (validTill && String(validTill).slice(0, 10) < today) return false;
  return true;
}

function isValidVoucher(v: any): boolean {
  return v.isValid === true && isDateRangeActive(v.validFrom, v.validTill);
}

// Rovnaká logika ako getCampaignMarket v lib/ehub.ts.
function getCampaignMarket(c: any): string {
  const country = String(c?.country ?? "").trim().toUpperCase();
  if (country && country !== "OTHER") return country;
  const web = String(c?.web ?? "").trim();
  if (web) {
    try {
      const host = new URL(web.includes("://") ? web : `https://${web}`).hostname;
      const tld = host.split(".").pop() ?? "";
      if (tld.length === 2) return tld.toUpperCase();
    } catch {}
  }
  return "OTHER";
}

function fmt(v: any): string {
  const code = v.code ? `kód=${v.code}` : "bez kódu (akcia)";
  return `[${v.id}] ${v.campaignName ?? "?"} — "${String(v.name ?? "").slice(0, 60)}" | isValid=${v.isValid} | validFrom=${v.validFrom ?? "-"} | validTill=${v.validTill ?? "-"} | ${code}`;
}

function fmtCampaign(c: any): string {
  return `[${c.id}] ${c.name} | country=${c.country ?? "-"} | market=${getCampaignMarket(c)} | web=${c.web ?? "-"}`;
}

async function fetchAllPages(partnerId: string, apiKey: string, pathName: string, listKey: string): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${BASE}/publishers/${partnerId}/${pathName}?apiKey=${apiKey}&page=${page}&perPage=${PER_PAGE}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = Array.isArray(data?.[listKey]) ? data[listKey] : [];
    items.push(...batch);
    const total = Number(data?.totalItems ?? 0);
    if (batch.length < PER_PAGE || (total > 0 && items.length >= total)) break;
  }
  return items;
}

async function main() {
  const partnerId = process.env.EHUB_PARTNER_ID ?? "";
  const apiKey = process.env.EHUB_API_KEY ?? "";
  if (!partnerId || !apiKey) throw new Error("Chýba EHUB_PARTNER_ID / EHUB_API_KEY");

  const [vouchers, campaigns] = await Promise.all([
    fetchAllPages(partnerId, apiKey, "vouchers", "vouchers"),
    fetchAllPages(partnerId, apiKey, "campaigns", "campaigns"),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Validity filter (nezmenený) ──
  const validKept = vouchers.filter(isValidVoucher);
  const validDropped = vouchers.filter(v => !isValidVoucher(v));

  console.log(`Audit eHub validity + market filtra (dnes: ${today})\n`);
  console.log("── Validity filter ──");
  console.log(`  Voucherov pred filtrom:  ${vouchers.length}`);
  console.log(`  Voucherov po filtri:     ${validKept.length}`);
  console.log(`  Zahodených:              ${validDropped.length}`);

  const notIsValid = validDropped.filter(v => v.isValid !== true).length;
  const notStarted = validDropped.filter(v => v.isValid === true && v.validFrom && String(v.validFrom).slice(0, 10) > today).length;
  const expired = validDropped.filter(v => v.isValid === true && v.validTill && String(v.validTill).slice(0, 10) < today).length;
  console.log(`  isValid !== true:        ${notIsValid}`);
  console.log(`  validFrom v budúcnosti:  ${notStarted}`);
  console.log(`  validTill v minulosti:   ${expired}`);

  // ── 2. Market filter (kampane) ──
  const marketByCampaignId = new Map<string, string>();
  for (const c of campaigns) marketByCampaignId.set(String(c.id ?? ""), getCampaignMarket(c));

  const campaignsKept = campaigns.filter(c => ALLOWED_MARKETS.has(getCampaignMarket(c)));
  const campaignsDropped = campaigns.filter(c => !ALLOWED_MARKETS.has(getCampaignMarket(c)));

  const byMarket = new Map<string, number>();
  for (const c of campaigns) {
    const m = getCampaignMarket(c);
    byMarket.set(m, (byMarket.get(m) ?? 0) + 1);
  }

  console.log("\n── Market filter: kampane ──");
  console.log(`  Kampaní pred filtrom:    ${campaigns.length}`);
  console.log(`  Kampaní po filtri:       ${campaignsKept.length}`);
  console.log(`  Vyradených:              ${campaignsDropped.length}`);
  console.log(`  SK kampaní:              ${byMarket.get("SK") ?? 0}`);
  console.log(`  CZ kampaní:              ${byMarket.get("CZ") ?? 0}`);
  console.log("  Vyradené podľa marketu:");
  for (const [m, n] of [...byMarket.entries()].sort((a, b) => b[1] - a[1])) {
    if (!ALLOWED_MARKETS.has(m)) console.log(`    ${m}: ${n}`);
  }

  console.log("\n── 10 príkladov vyradených obchodov (kampaní) ──");
  for (const c of campaignsDropped.slice(0, 10)) console.log(`  ${fmtCampaign(c)}`);

  console.log("\n── 10 príkladov ponechaných obchodov (kampaní) ──");
  for (const c of campaignsKept.slice(0, 10)) console.log(`  ${fmtCampaign(c)}`);

  // ── 3. Market filter (vouchery po validity filtri) ──
  const voucherMarket = (v: any) => marketByCampaignId.get(String(v.campaignId ?? "")) ?? "OTHER";
  const finalKept = validKept.filter(v => ALLOWED_MARKETS.has(voucherMarket(v)));
  const finalDropped = validKept.filter(v => !ALLOWED_MARKETS.has(voucherMarket(v)));

  const kupony = finalKept.filter(v => v.code && String(v.code).trim() !== "").length;
  const akcie = finalKept.length - kupony;

  console.log("\n── Market filter: vouchery (po validity filtri) ──");
  console.log(`  Voucherov pred market filtrom:  ${validKept.length}`);
  console.log(`  Voucherov po market filtri:     ${finalKept.length}`);
  console.log(`  Vyradených market filtrom:      ${finalDropped.length}`);
  console.log(`  Kupónov (s kódom):              ${kupony}`);
  console.log(`  Akcií (bez kódu):               ${akcie}`);
  if (finalDropped.length > 0) {
    console.log("  Vyradené vouchery:");
    for (const v of finalDropped.slice(0, 10)) console.log(`    ${fmt(v)} | market=${voucherMarket(v)}`);
  }

  console.log("\n── 10 príkladov ponechaných platných voucherov ──");
  for (const v of finalKept.slice(0, 10)) console.log(`  ${fmt(v)} | market=${voucherMarket(v)}`);
}

main().catch(err => {
  console.error("Audit zlyhal:", err);
  process.exit(1);
});
