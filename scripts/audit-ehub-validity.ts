/**
 * Audit eHub validity filtra
 *   Platný voucher = isValid === true
 *                  && (validFrom <= dnes, ak existuje)
 *                  && (validTill >= dnes, ak existuje)
 *
 * Stiahne všetky vouchery priamo z eHub API (rovnaká pagination ako lib/ehub.ts)
 * a vypíše počty pred/po filtri + príklady zahodených a ponechaných.
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

function isDateRangeActive(validFrom: string | null | undefined, validTill: string | null | undefined): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (validFrom && String(validFrom).slice(0, 10) > today) return false;
  if (validTill && String(validTill).slice(0, 10) < today) return false;
  return true;
}

function isValidVoucher(v: any): boolean {
  return v.isValid === true && isDateRangeActive(v.validFrom, v.validTill);
}

function fmt(v: any): string {
  const code = v.code ? `kód=${v.code}` : "bez kódu (akcia)";
  return `[${v.id}] ${v.campaignName ?? "?"} — "${String(v.name ?? "").slice(0, 60)}" | isValid=${v.isValid} | validFrom=${v.validFrom ?? "-"} | validTill=${v.validTill ?? "-"} | ${code}`;
}

async function main() {
  const partnerId = process.env.EHUB_PARTNER_ID ?? "";
  const apiKey = process.env.EHUB_API_KEY ?? "";
  if (!partnerId || !apiKey) throw new Error("Chýba EHUB_PARTNER_ID / EHUB_API_KEY");

  const vouchers: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${BASE}/publishers/${partnerId}/vouchers?apiKey=${apiKey}&page=${page}&perPage=${PER_PAGE}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = Array.isArray(data?.vouchers) ? data.vouchers : [];
    vouchers.push(...batch);
    const total = Number(data?.totalItems ?? 0);
    if (batch.length < PER_PAGE || (total > 0 && vouchers.length >= total)) break;
  }

  const kept = vouchers.filter(isValidVoucher);
  const dropped = vouchers.filter(v => !isValidVoucher(v));
  const today = new Date().toISOString().slice(0, 10);

  const kupony = kept.filter(v => v.code && String(v.code).trim() !== "").length;
  const akcie = kept.length - kupony;

  console.log(`Audit eHub validity filtra (dnes: ${today})\n`);
  console.log("── Súhrn ──");
  console.log(`  Voucherov pred filtrom:  ${vouchers.length}`);
  console.log(`  Voucherov po filtri:     ${kept.length}`);
  console.log(`  Zahodených:              ${dropped.length}`);
  console.log(`  Kupónov (s kódom):       ${kupony}`);
  console.log(`  Akcií (bez kódu):        ${akcie}`);

  // Dôvody zahodenia
  const notIsValid = dropped.filter(v => v.isValid !== true).length;
  const notStarted = dropped.filter(v => v.isValid === true && v.validFrom && String(v.validFrom).slice(0, 10) > today).length;
  const expired = dropped.filter(v => v.isValid === true && v.validTill && String(v.validTill).slice(0, 10) < today).length;
  console.log("\n── Dôvody zahodenia ──");
  console.log(`  isValid !== true:        ${notIsValid}`);
  console.log(`  validFrom v budúcnosti:  ${notStarted}`);
  console.log(`  validTill v minulosti:   ${expired}`);

  const expiredExamples = dropped
    .filter(v => v.validTill && String(v.validTill).slice(0, 10) < today)
    .sort((a, b) => String(b.validTill).localeCompare(String(a.validTill)))
    .slice(0, 10);
  console.log("\n── 10 príkladov zahodených expirovaných voucherov ──");
  for (const v of expiredExamples) console.log(`  ${fmt(v)}`);

  console.log("\n── 10 príkladov ponechaných platných voucherov ──");
  for (const v of kept.slice(0, 10)) console.log(`  ${fmt(v)}`);
}

main().catch(err => {
  console.error("Audit zlyhal:", err);
  process.exit(1);
});
