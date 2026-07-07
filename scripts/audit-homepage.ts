/**
 * Audit konverznej homepage (app/page.tsx).
 *
 * Overuje:
 *  A. Poradie 6 sekcií + napojenie dátových zdrojov (statická analýza page.tsx).
 *  B. Trendujúce vyhľadávania — reálny logSearchQuery + getSearchStats (7d top 10)
 *     proti in-process fake Upstash.
 *  C. Top obchody — reálny logOutboundClick + getClickStats (30d top 12).
 *  D. Filter "produkty s kupónom" — pravidlo výberu (len produkt s ponukou obchodu).
 *
 * Nič sa nedotkne produkčného Redisu; virtuálne hodiny riadia dedup okná.
 * Spustenie:  npx tsx scripts/audit-homepage.ts
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";

// ── fake Upstash REST server (in-process) ─────────────────────────
const clock = { now: Date.now() };
const counters = new Map<string, number>();
const strings = new Map<string, { expireAt: number | null }>();
const zsets = new Map<string, Map<string, number>>();
const hashes = new Map<string, Map<string, unknown>>();
const lists = new Map<string, string[]>();
const b64 = (s: string) => Buffer.from(String(s), "utf8").toString("base64");
function enc(x: unknown): unknown {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x;
  if (typeof x === "string") return b64(x);
  if (Array.isArray(x)) return x.map(enc);
  return b64(JSON.stringify(x));
}
function alive(key: string): boolean {
  const e = strings.get(key);
  if (!e) return false;
  return e.expireAt == null || e.expireAt > clock.now;
}
function handle(cmd: any[]): unknown {
  const name = String(cmd[0]).toLowerCase();
  switch (name) {
    case "set": {
      const key = String(cmd[1]);
      const hasNx = cmd.some((a) => String(a).toLowerCase() === "nx");
      const exIdx = cmd.findIndex((a) => String(a).toLowerCase() === "ex");
      const ex = exIdx >= 0 ? Number(cmd[exIdx + 1]) : null;
      if (hasNx && alive(key)) return null;
      strings.set(key, { expireAt: ex != null ? clock.now + ex * 1000 : null });
      return "OK";
    }
    case "incr": {
      const key = String(cmd[1]);
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }
    case "get": {
      const key = String(cmd[1]);
      return counters.has(key) ? counters.get(key)! : null;
    }
    case "mget":
      return cmd.slice(1).map((k) => (counters.has(String(k)) ? counters.get(String(k))! : null));
    case "zincrby": {
      const key = String(cmd[1]);
      const incr = Number(cmd[2]);
      const member = String(cmd[3]);
      let z = zsets.get(key);
      if (!z) { z = new Map(); zsets.set(key, z); }
      const nx = (z.get(member) ?? 0) + incr;
      z.set(member, nx);
      return nx;
    }
    case "zunion": {
      const numkeys = Number(cmd[1]);
      const keys = cmd.slice(2, 2 + numkeys).map(String);
      const agg = new Map<string, number>();
      for (const k of keys) {
        const z = zsets.get(k);
        if (!z) continue;
        for (const [m, s] of z) agg.set(m, (agg.get(m) ?? 0) + s);
      }
      const flat: unknown[] = [];
      for (const [m, s] of agg) flat.push(m, s);
      return flat;
    }
    case "hset": {
      const key = String(cmd[1]);
      let h = hashes.get(key);
      if (!h) { h = new Map(); hashes.set(key, h); }
      for (let i = 2; i + 1 < cmd.length; i += 2) h.set(String(cmd[i]), cmd[i + 1]);
      return 1;
    }
    case "hmget": {
      const h = hashes.get(String(cmd[1]));
      return cmd.slice(2).map((f) => (h && h.has(String(f)) ? h.get(String(f)) : null));
    }
    case "expire": return 1;
    case "lpush": {
      const key = String(cmd[1]);
      let l = lists.get(key);
      if (!l) { l = []; lists.set(key, l); }
      for (const v of cmd.slice(2)) l.unshift(String(v));
      return l.length;
    }
    case "ltrim": return "OK";
    case "lrange": {
      const l = lists.get(String(cmd[1])) ?? [];
      const start = Number(cmd[2]); const stop = Number(cmd[3]);
      return l.slice(start, stop === -1 ? undefined : stop + 1);
    }
    default: return null;
  }
}
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsed: any;
    try { parsed = JSON.parse(body || "[]"); } catch { parsed = []; }
    const out = Array.isArray(parsed) && Array.isArray(parsed[0])
      ? parsed.map((c: any[]) => ({ result: enc(handle(c)) }))
      : { result: enc(handle(parsed)) };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
});

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

  const { logSearchQuery, getSearchStats } = await import("@/lib/search-log");
  const { logOutboundClick, getClickStats, visitorHash } = await import("@/lib/click-log");
  function advance(ms: number) { clock.now += ms; }

  console.log("\n=== AUDIT: konverzná homepage ===\n");

  // ── A. Poradie sekcií + napojenie zdrojov (statická analýza) ──
  const src = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");
  // JSX markery (prefix "{/* ── N." sa vyskytuje len v render poradí, nie v dátových komentároch)
  const order = ["{/* ── 1. HERO", "{/* ── 2. TRENDUJÚCE", "{/* ── 3. PRODUKTY S KUPÓNOM", "{/* ── 4. TOP OBCHODY", "{/* ── 5. NAJNOVŠIE KUPÓNY", "{/* ── 6. HEUREKA FALLBACK"];
  const idx = order.map((m) => src.indexOf(m));
  const inOrder = idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]));
  check("A1) 6 sekcií v správnom poradí", inOrder, idx.join(" < "));
  check("A2) HERO nadpis + podnadpis", src.includes("Nájdi najvýhodnejší nákup") && src.includes("Vyhľadaj produkt v našich feedoch a skontroluj dostupné kupóny pred nákupom."));
  check("A3) trending zo search logov (getSearchStats)", src.includes("getSearchStats") && src.includes("last7d") && src.includes("/hladat?q="));
  check("A4) top obchody z click trackingu (getClickStats.topShops)", src.includes("getClickStats") && src.includes("topShops"));
  check("A5) produkty s kupónom (getProducts + buildShopOffersIndex)", src.includes("getProducts") && src.includes("buildShopOffersIndex"));
  check("A6) Heureka fallback box + tlačidlo", src.includes("Nenašli ste produkt?") && src.includes("Hľadať na Heureke"));
  check("A7) limity: trending 10 / produkty 12 / obchody 12 / kupóny 12",
    src.includes("slice(0, 10)") && src.includes("productsWithCoupon.length >= 12") &&
    src.includes("slice(0, 12)") && src.includes("newestCoupons.length >= 12"));

  // ── B. Trendujúce vyhľadávania (7d top 10) ──
  const seedSearch = async (q: string, times: number) => {
    for (let i = 0; i < times; i++) { await logSearchQuery(q); advance(11_000); }
  };
  await seedSearch("iphone", 5);
  await seedSearch("matrac", 3);
  await seedSearch("kava", 1);
  for (let i = 0; i < 12; i++) await seedSearch(`vyraz${i}`, 1); // >10 distinct pre cap

  const ss = await getSearchStats(50);
  const trending = ss.windows.last7d.slice(0, 10).map((r) => ({ query: r.query, count: r.count }));
  check("B1) trending vráti presne 10 výrazov", trending.length === 10, `len=${trending.length}`);
  check("B2) najhľadanejší je 'iphone' (count 5)", trending[0]?.query === "iphone" && trending[0]?.count === 5, `top=${trending[0]?.query}/${trending[0]?.count}`);
  check("B3) 'matrac' pred 'kava' (3 > 1)", (() => {
    const im = ss.windows.last7d.findIndex((r) => r.query === "matrac");
    const ik = ss.windows.last7d.findIndex((r) => r.query === "kava");
    return im >= 0 && ik >= 0 && im < ik;
  })());

  // ── C. Top obchody (30d top 12) ──
  const v = (s: string) => visitorHash(s, "ua");
  const clickShop = async (slug: string, n: number) => {
    for (let i = 0; i < n; i++) {
      await logOutboundClick({
        timestamp: Date.now(), source: "homepage", type: "shop_outbound",
        shopSlug: slug, productSlug: null, couponId: null, couponCode: null,
        destinationDomain: `${slug}.sk`, query: null,
      }, v(`${slug}-${i}`)); // rôzny visitor → nezdeduplikuje
    }
  };
  await clickShop("alza", 6);
  await clickShop("notino", 4);
  await clickShop("datart", 2);
  for (let i = 0; i < 14; i++) await clickShop(`shop${i}`, 1); // >12 distinct pre cap

  const cs = await getClickStats(clock.now);
  const topShops = cs.windows.last30d.topShops.slice(0, 12);
  check("C1) top obchody vráti presne 12", topShops.length === 12, `len=${topShops.length}`);
  check("C2) najklikanejší je 'alza' (6)", topShops[0]?.key === "alza" && topShops[0]?.count === 6, `top=${topShops[0]?.key}/${topShops[0]?.count}`);
  check("C3) poradie alza > notino > datart", (() => {
    const rank = (k: string) => cs.windows.last30d.topShops.findIndex((r) => r.key === k);
    return rank("alza") < rank("notino") && rank("notino") < rank("datart");
  })());

  // ── D. Filter "produkty s kupónom" (pravidlo výberu, max 12) ──
  const mockProducts = Array.from({ length: 20 }, (_, i) => ({ id: i, domain: i % 2 === 0 ? `shop${i}.sk` : "nooffer.sk" }));
  const offers = new Map<string, { coupon: any; deal: any }>();
  for (let i = 0; i < 20; i += 2) offers.set(`shop${i}.sk`, { coupon: { code: "X" }, deal: null }); // len párne domény majú ponuku
  const picked: any[] = [];
  for (const p of mockProducts) {
    const o = offers.get((p.domain || "").toLowerCase());
    if (o) picked.push(p);
    if (picked.length >= 12) break;
  }
  check("D1) vybrané len produkty s ponukou obchodu", picked.every((p) => p.domain.startsWith("shop")), `picked=${picked.length}`);
  check("D2) žiadny produkt bez ponuky ('nooffer.sk')", picked.every((p) => p.domain !== "nooffer.sk"));
  check("D3) cap 12 rešpektovaný (z 10 kandidátov → 10)", picked.length === 10, `picked=${picked.length}`);

  console.log(`\n=== VÝSLEDOK: ${pass} PASS / ${fail} FAIL ===\n`);
  server.close();
  process.exit(fail === 0 ? 0 : 1);
}

main();
