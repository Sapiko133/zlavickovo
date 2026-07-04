/**
 * Audit rozdelenia Kupóny vs Akcie
 *   Kupón = položka s kódom (tlačidlo "Zobraziť kód")
 *   Akcia = položka bez kódu (tlačidlo "Prejsť na ponuku")
 *
 * Počíta položky z rovnakých zdrojov ako /kupony (Dognet + Affial + eHub)
 * a pripočíta statické akcie (STATIC_AKCIE — zdroj pre shop stránky a /akcie).
 *
 * Spustenie: npx tsx scripts/audit-kupony-akcie.ts
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

function hasCode(c: any): boolean {
  return !!(c.code && String(c.code).trim() !== "");
}

// Affial priamo z feedu — getAffialCoupons je obalený v unstable_cache,
// ktorý mimo Next.js runtime nefunguje (incrementalCache missing)
async function fetchAffialDirect(): Promise<any[]> {
  const { XMLParser } = await import("fast-xml-parser");
  const res = await fetch("https://www.affial.com/kupony_feed.xml", { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Affial feed HTTP ${res.status}`);
  const result = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(await res.text());
  const raw = result?.coupons?.coupon || result?.feed?.item || result?.rss?.channel?.item || result?.items?.item || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .filter((item: any) => item && typeof item === "object")
    .map((item: any) => ({ code: item.code ?? item.coupon_code ?? "" }));
}

async function main() {
  const { getCoupons } = await import("../lib/dognet");
  const { getEhubCoupons } = await import("../lib/ehub");
  const { STATIC_AKCIE } = await import("../lib/akcie");

  const [dognet, affial, ehub] = await Promise.allSettled([
    getCoupons(),
    fetchAffialDirect(),
    getEhubCoupons(),
  ]);

  let kupony = 0;
  let akcie = 0;

  console.log("Audit Kupóny vs Akcie\n");
  console.log("── Zdroje (/kupony: Dognet + Affial + eHub) ──");
  for (const [name, res] of [["Dognet", dognet], ["Affial", affial], ["eHub", ehub]] as const) {
    if (res.status !== "fulfilled") {
      console.log(`  ⚠️  ${name}: nedostupný (${(res as PromiseRejectedResult).reason})`);
      continue;
    }
    const items: any[] = res.value ?? [];
    const k = items.filter(hasCode).length;
    const a = items.length - k;
    kupony += k;
    akcie += a;
    console.log(`  ${name}: ${items.length} položiek → ${k} kupónov, ${a} akcií`);
  }

  // Statické akcie (shop stránky + /akcie) — všetky bez kódu
  const staticAkcie = STATIC_AKCIE.length;
  akcie += staticAkcie;
  console.log(`  STATIC_AKCIE: ${staticAkcie} akcií (bez kódu)`);

  console.log("\n── Súhrn ──");
  console.log(`  Počet kupónov (s kódom, "Zobraziť kód"):      ${kupony}`);
  console.log(`  Počet akcií (bez kódu, "Prejsť na ponuku"):   ${akcie}`);

  console.log("\n── Testovacie URL ──");
  for (const u of [
    "https://www.zlavickovo.sk/kupony",
    "https://www.zlavickovo.sk/kupony/alza",
    "https://www.zlavickovo.sk/kategoria/moda",
    "https://www.zlavickovo.sk/",
    "https://www.zlavickovo.sk/hladat?q=notino",
  ]) {
    console.log(`  ${u}`);
  }
}

main().catch(e => {
  console.error("Audit zlyhal:", e);
  process.exit(1);
});
