/**
 * Validácia nových Affial XML feedov z CSV exportu ("XML FEEDY - XML feedy.csv").
 *
 * Pre každý kandidát (Heureka-formát, ktorého doména NIE je v HEUREKA_FEEDS):
 *  1. stiahne feed (timeout + byte cap ako produkčný import),
 *  2. naparsuje presne tým istým parserom (parseHeurekaXmlDetailed),
 *  3. vypíše status, počet produktov a % s EAN.
 *
 * Nezapisuje nič do DB — je to len health-check pred pridaním do feeds.ts.
 *
 * Spustenie: npx tsx scripts/validate-affial-feeds.ts
 */
import { readFileSync } from "node:fs";
import { parseHeurekaXmlDetailed } from "../lib/heureka/parser.ts";
import { HEUREKA_FEEDS } from "../lib/heureka/feeds.ts";

const CSV_PATH = "XML FEEDY - XML feedy.csv";
const FEED_TIMEOUT_MS = 25_000;
const MAX_BYTES = 30 * 1024 * 1024;

function splitCsvLine(line: string): string[] {
  return (line.match(/(".*?"|[^,]*)(,|$)/g) ?? [])
    .map((s) => s.replace(/,$/, "").replace(/^"|"$/g, "").trim())
    .slice(0, 4);
}

function domainFromUrl(u: string): string | null {
  try {
    return new URL(u.trim()).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

interface Candidate {
  category: string;
  campaign: string;
  url: string;
  domain: string;
}

function loadCandidates(): Candidate[] {
  const existDomains = new Set(HEUREKA_FEEDS.map((f) => f.domain.toLowerCase()));
  const existUrls = new Set(HEUREKA_FEEDS.map((f) => f.url));
  const lines = readFileSync(CSV_PATH, "utf8").split(/\r?\n/).slice(1);
  const seen = new Set<string>();
  const out: Candidate[] = [];

  for (const line of lines) {
    if (!line.trim() || /^,+$/.test(line)) continue;
    const [category, campaign, url, format] = splitCsvLine(line);
    if (!url || !/^https?:\/\//.test(url)) continue;
    const fmt = (format ?? "").toLowerCase();
    const isHeureka =
      fmt.includes("heureka") || url.includes("heureka") || url.includes("arukereso");
    if (!isHeureka) continue;
    const domain = domainFromUrl(url);
    if (!domain) continue;
    if (existDomains.has(domain) || existUrls.has(url.trim())) continue;
    if (seen.has(url.trim())) continue;
    seen.add(url.trim());
    out.push({ category, campaign, url: url.trim(), domain });
  }
  return out;
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error(`too big (${buf.byteLength} B)`);
  return new TextDecoder().decode(buf);
}

async function main() {
  const candidates = loadCandidates();
  console.log(`Kandidátov na validáciu: ${candidates.length}\n`);

  const rows: string[] = [];
  for (const c of candidates) {
    let line: string;
    try {
      const xml = await fetchXml(c.url);
      const parsed = parseHeurekaXmlDetailed(xml, c.category, {});
      const n = parsed.products.length;
      const withEan = parsed.products.filter((p) => p.ean).length;
      const eanPct = n > 0 ? Math.round((withEan / n) * 100) : 0;
      const flag = parsed.status === "success" && n > 0 ? "OK " : "!! ";
      line = `${flag}${c.domain.padEnd(34)} ${parsed.status.padEnd(18)} produkty=${String(n).padStart(5)}  EAN=${eanPct}%`;
    } catch (err) {
      line = `XX ${c.domain.padEnd(34)} ERROR              ${err instanceof Error ? err.message : String(err)}`;
    }
    console.log(line);
    rows.push(line);
  }

  const ok = rows.filter((r) => r.startsWith("OK ")).length;
  console.log(`\n=== ${ok}/${candidates.length} feedov OK (parsuje + má produkty) ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
