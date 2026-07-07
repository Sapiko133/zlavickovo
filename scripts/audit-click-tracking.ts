/**
 * Audit trackingu outbound klikov (lib/click-log.ts).
 *
 * Spúšťa REÁLNY logOutboundClick + getClickStats (a teda reálny @upstash/redis
 * klient) proti in-process fake Upstash REST serveru — nič sa nedotkne
 * produkčného Redisu. Virtuálne hodiny (zdieľané v procese) riadia 5s dedup
 * okno deterministicky, bez reálneho čakania.
 *
 * Spustenie:  npx tsx scripts/audit-click-tracking.ts
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

// ── in-memory store + virtuálne hodiny ────────────────────────────
const clock = { now: Date.now() };
const counters = new Map<string, number>();
const strings = new Map<string, { expireAt: number | null }>();
const zsets = new Map<string, Map<string, number>>();
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
    case "mget": {
      return cmd.slice(1).map((k) => (counters.has(String(k)) ? counters.get(String(k))! : null));
    }
    case "zincrby": {
      const key = String(cmd[1]);
      const incr = Number(cmd[2]);
      const member = String(cmd[3]);
      let z = zsets.get(key);
      if (!z) { z = new Map(); zsets.set(key, z); }
      const next = (z.get(member) ?? 0) + incr;
      z.set(member, next);
      return next;
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
      const key = String(cmd[1]);
      const l = lists.get(key) ?? [];
      const start = Number(cmd[2]);
      const stop = Number(cmd[3]);
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
    let out: unknown;
    if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
      out = parsed.map((c: any[]) => ({ result: enc(handle(c)) }));
    } else {
      out = { result: enc(handle(parsed)) };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

  const { logOutboundClick, getClickStats, getRecentClicks, visitorHash } = await import("@/lib/click-log");

  function advance(ms: number) { clock.now += ms; }
  let pass = 0, fail = 0;
  function check(name: string, cond: boolean, detail = "") {
    if (cond) { pass++; console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`); }
    else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
  }

  const ev = (over: any) => ({
    timestamp: Date.now(),
    source: "audit",
    type: over.type,
    shopSlug: over.shopSlug ?? null,
    productSlug: over.productSlug ?? null,
    couponId: over.couponId ?? null,
    couponCode: over.couponCode ?? null,
    destinationDomain: over.destinationDomain ?? null,
    query: over.query ?? null,
  });

  console.log("\n=== AUDIT: tracking outbound klikov ===\n");

  // Po jednom evente na každý typ (rôzny visitor+target → čisté počty)
  const v = (s: string) => visitorHash(s, "audit-ua");
  await logOutboundClick(ev({ type: "product_outbound", shopSlug: "alza", productSlug: "iphone-15-1", destinationDomain: "alza.sk", query: "iphone" }), v("u1"));
  await logOutboundClick(ev({ type: "coupon_reveal", shopSlug: "notino", couponCode: "SAVE10", destinationDomain: "notino.sk" }), v("u2"));
  await logOutboundClick(ev({ type: "coupon_outbound", shopSlug: "datart", destinationDomain: "datart.sk" }), v("u3"));
  await logOutboundClick(ev({ type: "action_outbound", shopSlug: "zalando", destinationDomain: "zalando.sk" }), v("u4"));
  await logOutboundClick(ev({ type: "shop_outbound", shopSlug: "gymbeam", destinationDomain: "gymbeam.sk" }), v("u5"));
  await logOutboundClick(ev({ type: "heureka_fallback", destinationDomain: "heureka.sk", query: "matrac" }), v("u6"));

  const s1 = await getClickStats(clock.now);
  const typeCount = (t: string) => s1.windows.last24h.byType.find((r) => r.key === t)?.count ?? 0;

  check("1) product_outbound zalogovaný", typeCount("product_outbound") === 1, `count=${typeCount("product_outbound")}`);
  check("2) coupon_reveal zalogovaný", typeCount("coupon_reveal") === 1, `count=${typeCount("coupon_reveal")}`);
  check("3) coupon_outbound zalogovaný", typeCount("coupon_outbound") === 1, `count=${typeCount("coupon_outbound")}`);
  check("4) action_outbound zalogovaný", typeCount("action_outbound") === 1, `count=${typeCount("action_outbound")}`);
  check("5) shop_outbound zalogovaný", typeCount("shop_outbound") === 1, `count=${typeCount("shop_outbound")}`);
  check("6) heureka_fallback zalogovaný", typeCount("heureka_fallback") === 1, `count=${typeCount("heureka_fallback")}`);
  check("   heurekaFallback agregát == 1", s1.windows.last24h.heurekaFallback === 1, `hf=${s1.windows.last24h.heurekaFallback}`);
  check("   total (24h) == 6", s1.windows.last24h.total === 6, `total=${s1.windows.last24h.total}`);
  check("   top obchod obsahuje 'alza'", s1.windows.last24h.topShops.some((r) => r.key === "alza"), `shops=${s1.windows.last24h.topShops.length}`);
  check("   top produkt obsahuje 'iphone-15-1'", s1.windows.last24h.topProducts.some((r) => r.key === "iphone-15-1"), `products=${s1.windows.last24h.topProducts.length}`);
  check("   top kupón obsahuje 'SAVE10'", s1.windows.last24h.topCoupons.some((r) => r.key === "SAVE10"), `coupons=${s1.windows.last24h.topCoupons.length}`);

  // 7) Deduplikácia do 5 s — rovnaký visitor + rovnaký target
  const shopEv = () => ev({ type: "shop_outbound", shopSlug: "dedupshop", destinationDomain: "dedupshop.sk" });
  const r1 = await logOutboundClick(shopEv(), v("dedup"));
  const r2 = await logOutboundClick(shopEv(), v("dedup")); // do 5s → dedup
  const cnt = (now: number) =>
    (getClickStats(now)).then((s) => s.windows.last24h.topShops.find((r) => r.key === "dedupshop")?.count ?? 0);

  check("7a) 1. klik započítaný", r1.counted === true);
  check("7b) 2. klik (do 5s, ten istý visitor) NEzapočítaný", r2.counted === false);
  check("7c) počet pre 'dedupshop' == 1", (await cnt(clock.now)) === 1, `count=${await cnt(clock.now)}`);

  // iný visitor → započíta sa
  const r3 = await logOutboundClick(shopEv(), v("dedup2"));
  check("7d) iný visitor sa započíta", r3.counted === true && (await cnt(clock.now)) === 2, `count=${await cnt(clock.now)}`);

  // po 6 s ten istý visitor → okno uplynulo, započíta sa
  advance(6000);
  const r4 = await logOutboundClick(shopEv(), v("dedup"));
  check("7e) ten istý visitor po 6s sa započíta", r4.counted === true && (await cnt(clock.now)) === 3, `count=${await cnt(clock.now)}`);

  // Náhľad príkladov eventov
  const recent = await getRecentClicks(3);
  console.log("\n  Príklady zalogovaných eventov:");
  for (const e of recent) console.log("   ", JSON.stringify(e));

  console.log(`\n=== VÝSLEDOK: ${pass} PASS / ${fail} FAIL ===\n`);
  server.close();
  process.exit(fail === 0 ? 0 : 1);
}

main();
