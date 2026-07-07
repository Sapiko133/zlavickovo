/**
 * Audit Heureka XML feedov — identifikátory produktov.
 *
 * Pre každý feed stiahne začiatok XML (rovnaký stream-capped prístup ako
 * lib/heureka/import.ts, max ~500 SHOPITEMov) a spočíta výskyt polí:
 *   EAN, GTIN, PRODUCTNO, MANUFACTURER, ISBN, BRAND, ITEM_ID
 *
 * Výstup: pokrytie per feed + agregát cez všetky feedy.
 *
 * Spustenie: npx tsx scripts/audit-heureka-identifiers.ts
 */
import { XMLParser } from "fast-xml-parser";
import { HEUREKA_FEEDS } from "../lib/heureka/feeds";

const MAX_ITEMS = 500;
const MAX_BYTES = 20 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

// ---- stream-capped fetch (skopírované z lib/heureka/import.ts) ----
function nextShopitemEnd(xml: string, from: number): number {
  const upper = xml.indexOf("</SHOPITEM>", from);
  const lower = xml.indexOf("</shopitem>", from);
  const idx = upper === -1 ? lower : lower === -1 ? upper : Math.min(upper, lower);
  return idx === -1 ? -1 : idx + "</SHOPITEM>".length;
}
function closeTruncatedXml(xml: string): string {
  const closers: string[] = [];
  const head = xml.slice(0, 4096);
  for (const m of head.matchAll(/<(rss|RSS|SHOP|shop)(?=[\s>])/g)) closers.unshift(`</${m[1]}>`);
  return xml + closers.join("");
}
async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let xml = "";
  let items = 0;
  let searchFrom = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return xml + decoder.decode();
      xml += decoder.decode(value, { stream: true });
      let end: number;
      while (items < MAX_ITEMS && (end = nextShopitemEnd(xml, searchFrom)) !== -1) {
        items++;
        searchFrom = end;
      }
      if (items >= MAX_ITEMS) return closeTruncatedXml(xml.slice(0, searchFrom));
      if (xml.length >= MAX_BYTES) return searchFrom > 0 ? closeTruncatedXml(xml.slice(0, searchFrom)) : xml;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// case-insensitive lookup poľa v SHOPITEM objekte
function pick(item: any, key: string): string {
  for (const k of Object.keys(item)) {
    if (k.toLowerCase() === key.toLowerCase()) {
      const v = item[k];
      if (v == null) return "";
      if (typeof v === "object") return "";
      return String(v).trim();
    }
  }
  return "";
}

// BRAND môže byť aj v <PARAM><PARAM_NAME>Značka</PARAM_NAME><VAL>..</VAL></PARAM>
function hasBrandParam(item: any): boolean {
  let params = item.PARAM ?? item.param;
  if (!params) return false;
  if (!Array.isArray(params)) params = [params];
  return params.some((p: any) => {
    const nameRaw = p?.PARAM_NAME ?? p?.param_name ?? p?.name ?? "";
    const name = String(nameRaw).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return name === "znacka" || name === "brand" || name === "vyrobce" || name === "vyrobca";
  });
}

const FIELDS = ["EAN", "GTIN", "PRODUCTNO", "MANUFACTURER", "ISBN", "BRAND", "ITEM_ID"] as const;
type Field = (typeof FIELDS)[number];

interface FeedStat {
  feedId: string;
  domain: string;
  items: number;
  error?: string;
  counts: Record<Field, number>;
  brandParam: number; // BRAND cez PARAM
}

async function auditFeed(feed: (typeof HEUREKA_FEEDS)[number]): Promise<FeedStat> {
  const counts = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<Field, number>;
  const stat: FeedStat = { feedId: feed.id, domain: feed.domain, items: 0, counts, brandParam: 0 };
  try {
    const xml = await fetchXml(feed.url);
    const parsed = parser.parse(xml);
    const shopRoot =
      parsed?.SHOP ?? parsed?.shop ?? parsed?.rss?.SHOP ?? parsed?.rss?.shop ?? parsed?.RSS?.SHOP ?? parsed?.RSS?.shop ?? parsed;
    let rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
    if (!rawItems) {
      stat.error = "žiadne SHOPITEM";
      return stat;
    }
    const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      stat.items++;
      for (const f of FIELDS) {
        if (pick(item, f) !== "") counts[f]++;
      }
      if (hasBrandParam(item)) stat.brandParam++;
    }
  } catch (err: any) {
    stat.error = String(err?.message ?? err).slice(0, 120);
  }
  return stat;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return ((n / total) * 100).toFixed(1) + "%";
}

async function main() {
  console.log(`Audit ${HEUREKA_FEEDS.length} Heureka feedov (max ${MAX_ITEMS} položiek/feed)\n`);

  const stats: FeedStat[] = [];
  const BATCH = 8;
  for (let i = 0; i < HEUREKA_FEEDS.length; i += BATCH) {
    const batch = HEUREKA_FEEDS.slice(i, i + BATCH);
    const res = await Promise.all(batch.map(auditFeed));
    stats.push(...res);
    process.stderr.write(`  ...${Math.min(i + BATCH, HEUREKA_FEEDS.length)}/${HEUREKA_FEEDS.length}\n`);
  }

  // Per-feed tabuľka
  console.log("PER FEED (items | EAN | GTIN | PRODUCTNO | MANUFACTURER | ISBN | BRAND | ITEM_ID | brandParam)");
  console.log("-".repeat(120));
  for (const s of stats) {
    if (s.error) {
      console.log(`  ✗ ${s.domain.padEnd(28)} CHYBA: ${s.error}`);
      continue;
    }
    const c = s.counts;
    console.log(
      `    ${s.domain.padEnd(28)} ${String(s.items).padStart(4)} | ` +
        `${pct(c.EAN, s.items).padStart(6)} | ${pct(c.GTIN, s.items).padStart(6)} | ` +
        `${pct(c.PRODUCTNO, s.items).padStart(6)} | ${pct(c.MANUFACTURER, s.items).padStart(6)} | ` +
        `${pct(c.ISBN, s.items).padStart(6)} | ${pct(c.BRAND, s.items).padStart(6)} | ` +
        `${pct(c.ITEM_ID, s.items).padStart(6)} | ${pct(s.brandParam, s.items).padStart(6)}`
    );
  }

  // Agregát
  const ok = stats.filter((s) => !s.error && s.items > 0);
  const totalItems = ok.reduce((a, s) => a + s.items, 0);
  const agg = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<Field, number>;
  let brandParamTotal = 0;
  const feedsWith = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<Field, number>;
  for (const s of ok) {
    for (const f of FIELDS) {
      agg[f] += s.counts[f];
      if (s.counts[f] > 0) feedsWith[f]++;
    }
    brandParamTotal += s.brandParam;
  }

  console.log("\n" + "=".repeat(60));
  console.log("AGREGÁT");
  console.log("=".repeat(60));
  console.log(`Feedov spolu:          ${HEUREKA_FEEDS.length}`);
  console.log(`Feedov OK (s dátami):  ${ok.length}`);
  console.log(`Feedov s chybou:       ${stats.filter((s) => s.error).length}`);
  console.log(`Produktov (vzorka):    ${totalItems}`);
  console.log("");
  console.log("Pole          | feedov s poľom | produktov s poľom | % pokrytie produktov");
  console.log("-".repeat(75));
  for (const f of FIELDS) {
    console.log(
      `${f.padEnd(13)} | ${String(feedsWith[f]).padStart(14)} | ${String(agg[f]).padStart(17)} | ${pct(agg[f], totalItems)}`
    );
  }
  console.log(`${"BRAND(PARAM)".padEnd(13)} | ${"".padStart(14)} | ${String(brandParamTotal).padStart(17)} | ${pct(brandParamTotal, totalItems)}`);

  // EAN špecificky
  console.log("\nEAN pokrytie:");
  console.log(`  produkty s EAN:    ${agg.EAN} (${pct(agg.EAN, totalItems)})`);
  console.log(`  produkty bez EAN:  ${totalItems - agg.EAN} (${pct(totalItems - agg.EAN, totalItems)})`);
  console.log(`  feedov s EAN aspoň v 1 produkte: ${feedsWith.EAN}/${ok.length}`);
  const eanFull = ok.filter((s) => s.counts.EAN === s.items).length;
  const eanNone = ok.filter((s) => s.counts.EAN === 0).length;
  console.log(`  feedov s EAN v 100% produktov:   ${eanFull}/${ok.length}`);
  console.log(`  feedov bez EAN úplne:            ${eanNone}/${ok.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
