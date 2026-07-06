/**
 * Audit CJ tracking linkov
 *   Problém: lib/cj.ts používal <destination> (cieľová URL obchodu bez trackingu)
 *   namiesto <clickUrl> (CJ tracking link cez www.anrdoezrs.net / www.tkqlkg.com atď.).
 *
 * Skript stiahne živé XML z CJ link-search API a vypíše:
 *   - zoznam tagov v prvom <link> elemente
 *   - 10 kupónových položiek: destination vs clickUrl + či clickUrl obsahuje CJ tracking doménu
 *   - počty: koľko položiek má clickUrl, koľko by padlo na destination fallback
 *
 * Spustenie: npx tsx scripts/audit-cj-links.ts
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

// CJ tracking domény (link-search clickUrl vždy smeruje cez jednu z nich)
const CJ_TRACKING = /(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|qksrv\.net|cj\.dotomi\.com|emjcd\.com)/i;

function xmlField(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() ?? "";
}

async function fetchCj(params: Record<string, string>): Promise<string | null> {
  const apiKey = process.env.CJ_API_KEY;
  const websiteId = process.env.CJ_WEBSITE_ID;
  if (!apiKey || !websiteId) {
    console.error("Chýba CJ_API_KEY alebo CJ_WEBSITE_ID");
    return null;
  }
  const qs = new URLSearchParams({
    "website-id": websiteId,
    "link-type": "Text Link",
    "advertiser-ids": "joined",
    "records-per-page": "200",
    ...params,
  });
  const res = await fetch(`https://link-search.api.cj.com/v2/link-search?${qs}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.error(`CJ API ${res.status}: ${await res.text()}`);
    return null;
  }
  return res.text();
}

async function main() {
  const xml = await fetchCj({ "promotion-type": "Coupon" });
  if (!xml) process.exit(1);

  const links = [...xml.matchAll(/<link>([\s\S]*?)<\/link>/g)].map((m) => m[1]);
  console.log(`Celkom <link> elementov (Coupon): ${links.length}\n`);

  if (links.length > 0) {
    const tags = [...new Set([...links[0].matchAll(/<([a-zA-Z-]+)>/g)].map((m) => m[1]))];
    console.log("Tagy v prvom <link>:", tags.join(", "), "\n");
  }

  let withClickUrl = 0;
  let fallbackDestination = 0;
  let clickUrlIsTracking = 0;

  for (const link of links) {
    const clickUrl = xmlField(link, "clickUrl");
    if (clickUrl) {
      withClickUrl++;
      if (CJ_TRACKING.test(clickUrl)) clickUrlIsTracking++;
    } else {
      fallbackDestination++;
    }
  }

  console.log("=== 10 položiek: destination (PRED) vs clickUrl (PO) ===");
  const sample = links.filter((l) => xmlField(l, "coupon-code")).slice(0, 10);
  sample.forEach((link, i) => {
    const clickUrl = xmlField(link, "clickUrl");
    const dest = xmlField(link, "destination");
    const used = clickUrl || dest;
    console.log(`\n${i + 1}. ${xmlField(link, "advertiser-name")} — kód: ${xmlField(link, "coupon-code")}`);
    console.log(`   PRED (destination): ${dest.slice(0, 110)}`);
    console.log(`   PO   (clickUrl):    ${clickUrl.slice(0, 110) || "(chýba → fallback destination)"}`);
    console.log(`   tracking doména: ${CJ_TRACKING.test(used) ? "ANO" : "NIE"}${!clickUrl ? " (fallback)" : ""}`);
  });

  console.log("\n=== Súhrn ===");
  console.log(`Položiek s clickUrl:          ${withClickUrl}/${links.length}`);
  console.log(`  z toho CJ tracking doména:  ${clickUrlIsTracking}`);
  console.log(`Fallback na destination:      ${fallbackDestination}/${links.length}`);
}

main();
