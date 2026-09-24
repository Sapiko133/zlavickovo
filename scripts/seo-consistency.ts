/**
 * SEO konzistencia — overí rovnosť v OBOCH smeroch:
 *   indexovateľné (200 + robots index + self-canonical)  ⇔  URL je v sitemap
 * a že noindex / redirect / 404 / canonical-inde nie sú v sitemap.
 *
 * Univerzum URL: všetky obchody z registra (+ -cz varianty, aliasy, veľké písmená,
 * tracking parametre), všetky akcie z Redis (aktívne, ukončené, duplikáty),
 * všetky kategórie (aj skrytá), letáky, hub stránky a stránkovanie.
 *
 * Spustenie: npx tsx scripts/seo-consistency.ts [base] [--json out.json]
 * Exit 1 pri akomkoľvek porušení.
 */
import * as fs from "fs";

fs.readFileSync(".env.local", "utf-8").split(/\r?\n/).forEach((line) => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
});

async function main() {
  const args = process.argv.slice(2);
  const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "https://www.zlavickovo.sk").replace(/\/$/, "");
  const jsonIdx = args.indexOf("--json");
  const origin = new URL(base).origin;
  const PROD = "https://www.zlavickovo.sk";
  const toBase = (u: string) => u.replace(/^https?:\/\/(www\.)?zlavickovo\.sk/i, base);

  const { fetchPage, fetchSitemapUrls } = await import("../lib/seo/audit");
  const { getShopRegistry } = await import("../lib/seo/shop-registry");
  const { getAllArticles } = await import("../lib/articles");
  const { TAXONOMY } = await import("../lib/taxonomy");
  const { LETAKY } = await import("../lib/letaky");

  const sm = await fetchSitemapUrls(`${base}/sitemap.xml`, toBase);
  if (sm.errors.length) { console.error("Sitemap chyby:", sm.errors); process.exit(1); }
  const sitemap = new Set(sm.urls.map(toBase));

  const reg = await getShopRegistry();
  const articles = await getAllArticles();
  const typed: { url: string; type: string }[] = [];
  const add = (type: string, path: string) => typed.push({ type, url: `${base}${path}` });

  for (const slug of reg.bySlug.keys()) add("shop", `/kupony/${slug}`);
  for (const slug of ["alza", "notino", "sizeer"]) add("shop-cz-variant", `/kupony/${slug}-cz`);
  for (const alias of [...reg.aliases.keys(), "aboutyou", "drmax", "Alza"]) add("shop-alias", `/kupony/${alias}`);
  for (const slug of ["alza", "sizeer"]) add("tracking-param", `/kupony/${slug}?utm_source=x&gclid=y`);
  for (const a of articles) add(`offer-${a.type}${a.published ? "" : "-unpublished"}`, `/akcie/${a.slug}`);
  for (const id of Object.keys(TAXONOMY)) add("category", `/kategoria/${id}`);
  add("category-alias", "/kategoria/Moda");
  for (const l of LETAKY) add("leaflet", `/letaky/${l.slug}`);
  for (const p of ["/", "/akcie", "/kupony", "/obchody", "/kategoria", "/letaky", "/o-nas", "/inzercia", "/privacy", "/hladat"]) add("hub", p);
  for (const p of ["/kupony?page=2", "/kupony?page=3", "/kupony?page=9999", "/kupony?sort=discount", "/kupony?cat=moda"]) add("pagination-filter", p);

  // Aj každá URL zo sitemap musí byť v univerze (inak by smer sitemap → indexovateľné nebol overený).
  const known = new Set(typed.map((t) => t.url));
  for (const u of sitemap) if (!known.has(u)) typed.push({ type: "sitemap-only", url: u });

  const concurrency = Number(process.env.SEO_AUDIT_CONCURRENCY ?? 8);
  const results: { url: string; type: string; status: number; indexable: boolean; canonical: string | null; robots: string | null; inSitemap: boolean; redirectTo: string | null }[] = [];
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < typed.length) {
      const t = typed[i++];
      const f = await fetchPage(t.url, origin, 30000);
      const selfCanonical = !!f.canonical && toBase(f.canonical) === t.url;
      results.push({
        url: t.url.replace(base, ""), type: t.type, status: f.status,
        indexable: f.status === 200 && f.indexable && selfCanonical,
        canonical: f.canonical?.replace(PROD, "") ?? null, robots: f.robots, inSitemap: sitemap.has(t.url),
        redirectTo: f.redirectTo,
      });
      if (++done % 100 === 0) console.log(`  ${done}/${typed.length}`);
    }
  }));

  const violations = results.filter((r) => r.indexable !== r.inSitemap);
  const byType = new Map<string, { total: number; indexable: number; inSitemap: number; s404: number; s3xx: number; noindex: number; violations: number }>();
  for (const r of results) {
    const b = byType.get(r.type) ?? { total: 0, indexable: 0, inSitemap: 0, s404: 0, s3xx: 0, noindex: 0, violations: 0 };
    b.total++;
    if (r.indexable) b.indexable++;
    if (r.inSitemap) b.inSitemap++;
    if (r.status === 404 || r.status === 410) b.s404++;
    if (r.status >= 300 && r.status < 400) b.s3xx++;
    if (r.status === 200 && !r.indexable) b.noindex++;
    if (r.indexable !== r.inSitemap) b.violations++;
    byType.set(r.type, b);
  }
  console.log(`\nSEO konzistencia ${base} — ${results.length} URL, sitemap ${sitemap.size}`);
  console.log("typ".padEnd(24), "spolu idx  sm  404 3xx noidx PORUŠ.");
  for (const [t, b] of [...byType].sort()) {
    console.log(t.padEnd(24), String(b.total).padStart(5), String(b.indexable).padStart(4), String(b.inSitemap).padStart(3), String(b.s404).padStart(4), String(b.s3xx).padStart(3), String(b.noindex).padStart(5), String(b.violations).padStart(6));
  }
  const fetchErrors = results.filter((r) => r.status === 0);
  if (fetchErrors.length) console.log(`\nChyby fetchu (${fetchErrors.length}):`, fetchErrors.slice(0, 10).map((r) => r.url).join(", "));
  if (violations.length) {
    console.log(`\nPORUŠENIA (${violations.length}):`);
    for (const v of violations.slice(0, 50)) {
      console.log(`  ${v.url}  [${v.type}] status=${v.status} indexable=${v.indexable} inSitemap=${v.inSitemap} robots="${v.robots}" canonical=${v.canonical}`);
    }
  } else {
    console.log("\nOK: indexovateľné ⇔ sitemap (0 porušení)");
  }
  if (jsonIdx >= 0) fs.writeFileSync(args[jsonIdx + 1], JSON.stringify(results, null, 1));
  process.exit(violations.length || fetchErrors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
