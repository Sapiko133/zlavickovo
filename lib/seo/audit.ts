/**
 * SEO audit engine — crawluje hotové HTML (produkcia alebo lokálny server)
 * a hlási konkrétne URL s problémami. Zdieľa ho:
 *   - scripts/seo-audit.ts         (CLI, finálny test, CI)
 *   - /api/admin/seo-health        (admin dashboard /admin/seo)
 *
 * Bez závislostí (regex parser stačí na naše vlastné, predvídateľné HTML).
 */
import { validateJsonLd } from "./jsonld";

export type Severity = "error" | "warning" | "info";

export interface PageFacts {
  url: string;
  status: number;
  /** Cieľ presmerovania (pri 3xx) a počet skokov do finálnej URL. */
  redirectTo: string | null;
  redirectHops: number;
  title: string | null;
  description: string | null;
  h1: string[];
  canonical: string | null;
  robots: string | null;
  indexable: boolean;
  jsonLdTypes: string[];
  jsonLdErrors: string[];
  internalLinks: string[];
  imagesWithoutAlt: number;
  textLength: number;
  /** Stránka ponuky označená ako ukončená (data-offer-status="expired"). */
  offerExpired: boolean;
  /** Počet aktívnych ponúk deklarovaný šablónou (data-active-offers), null = šablóna ho nedeklaruje. */
  activeOffers: number | null;
  ms: number;
  error?: string;
}

export interface AuditIssue {
  code: string;
  severity: Severity;
  url: string;
  detail: string;
}

export interface AuditReport {
  base: string;
  startedAt: string;
  finishedAt: string;
  summary: Record<string, number>;
  issues: AuditIssue[];
  pages: Omit<PageFacts, "internalLinks">[];
}

// ─── HTML parsing ───────────────────────────────────────────────────────────

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3] ?? "") : null;
}

function metaContent(html: string, key: "name" | "property", value: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, key) ?? "").toLowerCase() === value) return attr(tag, "content");
  }
  return null;
}

export function parseHtml(html: string, pageUrl: string, origin: string) {
  const head = html.slice(0, html.search(/<body\b/i) > 0 ? html.search(/<body\b/i) : html.length);
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  let canonical: string | null = null;
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "rel") ?? "").toLowerCase() === "canonical") { canonical = attr(tag, "href"); break; }
  }
  const robots = metaContent(head, "name", "robots");
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " ")));

  const jsonLdTypes: string[] = [];
  const jsonLdErrors: string[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const r = validateJsonLd(JSON.parse(m[1]));
      jsonLdTypes.push(...r.types);
      jsonLdErrors.push(...r.errors);
    } catch {
      jsonLdErrors.push("neparsovateľný JSON-LD");
    }
  }

  const internal = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi)) {
    const tag = m[0];
    const href = decode(m[2] ?? m[3] ?? "");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (/\bnofollow\b/i.test(attr(tag, "rel") ?? "")) continue;
    try {
      const u = new URL(href, pageUrl);
      if (u.origin !== origin) continue;
      u.hash = "";
      internal.add(u.pathname + u.search);
    } catch {}
  }

  let imagesWithoutAlt = 0;
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (attr(tag, "alt") === null) imagesWithoutAlt++;
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const robotsLc = (robots ?? "").toLowerCase();
  return {
    title: title !== undefined ? decode(title) : null,
    description: metaContent(head, "name", "description"),
    h1,
    canonical,
    robots,
    indexable: !/noindex|none/.test(robotsLc),
    jsonLdTypes,
    jsonLdErrors,
    internalLinks: [...internal],
    imagesWithoutAlt,
    textLength: decode(bodyText).length,
    offerExpired: /data-offer-status=["']expired["']/.test(html),
    activeOffers: (() => {
      const m = html.match(/data-active-offers=["'](\d+)["']/);
      return m ? Number(m[1]) : null;
    })(),
  };
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

const UA = "ZlavickovoSeoAudit/1.0 (+https://www.zlavickovo.sk)";

export async function fetchPage(url: string, origin: string, timeoutMs = 25000): Promise<PageFacts> {
  const t0 = Date.now();
  const empty: PageFacts = {
    url, status: 0, redirectTo: null, redirectHops: 0, title: null, description: null, h1: [],
    canonical: null, robots: null, indexable: false, jsonLdTypes: [], jsonLdErrors: [],
    internalLinks: [], imagesWithoutAlt: 0, textLength: 0, offerExpired: false, activeOffers: null, ms: 0,
  };
  try {
    let current = url;
    let hops = 0;
    let firstRedirect: string | null = null;
    let firstStatus = 0;
    for (;;) {
      const res = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!firstStatus) firstStatus = res.status;
      if (res.status >= 300 && res.status < 400 && res.headers.get("location") && hops < 5) {
        const next = new URL(res.headers.get("location")!, current).toString();
        if (!firstRedirect) firstRedirect = next;
        hops++;
        current = next;
        await res.body?.cancel();
        continue;
      }
      if (hops > 0) {
        await res.body?.cancel();
        return { ...empty, status: firstStatus, redirectTo: firstRedirect, redirectHops: hops, ms: Date.now() - t0 };
      }
      const html = res.headers.get("content-type")?.includes("html") ? await res.text() : "";
      if (!html) await res.body?.cancel().catch(() => {});
      const parsed = html ? parseHtml(html, url, origin) : {};
      // HTTP hlavička X-Robots-Tag má rovnakú váhu ako meta robots.
      const xRobots = res.headers.get("x-robots-tag");
      const facts: PageFacts = { ...empty, ...parsed, status: res.status, ms: Date.now() - t0 };
      if (xRobots && /noindex|none/i.test(xRobots)) { facts.indexable = false; facts.robots = `${facts.robots ?? ""} x-robots:${xRobots}`.trim(); }
      if (res.status !== 200) facts.indexable = false;
      return facts;
    }
  } catch (e) {
    return { ...empty, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchSitemapUrls(
  sitemapUrl: string,
  rewrite: (u: string) => string = (u) => u,
): Promise<{ urls: string[]; errors: string[]; files: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];
  const files: string[] = [];
  const visit = async (u: string, depth: number) => {
    files.push(u);
    const res = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) }).catch((e) => e as Error);
    if (res instanceof Error) { errors.push(`${u}: ${res.message}`); return; }
    if (res.status !== 200) { errors.push(`${u}: HTTP ${res.status}`); return; }
    const ct = res.headers.get("content-type") ?? "";
    const xml = await res.text();
    if (!/xml/.test(ct)) errors.push(`${u}: content-type "${ct}" nie je XML`);
    if (!xml.trimStart().startsWith("<?xml")) errors.push(`${u}: chýba XML deklarácia`);
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]));
    if (/<sitemapindex\b/.test(xml)) {
      if (depth > 1) { errors.push(`${u}: vnorený sitemapindex`); return; }
      for (const child of locs) await visit(rewrite(child), depth + 1);
    } else if (/<urlset\b/.test(xml)) {
      if (locs.length > 50000) errors.push(`${u}: ${locs.length} URL > limit 50 000`);
      if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)) errors.push(`${u}: neescapovaný znak &`);
      urls.push(...locs);
    } else {
      errors.push(`${u}: ani urlset ani sitemapindex`);
    }
  };
  await visit(sitemapUrl, 0);
  return { urls, errors, files };
}

async function pool<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

// ─── Analýza ────────────────────────────────────────────────────────────────

const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 165;
/** Pod touto dĺžkou viditeľného textu (bez nav/footer) považujeme stránku za thin. */
const THIN_TEXT = 600;

function hasRepeatedSegments(title: string): string | null {
  const segs = title.split(/\s*[|·–-]\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  for (const s of segs) {
    if (seen.has(s)) return s;
    seen.add(s);
  }
  const brand = (title.match(/zlavickovo/gi) ?? []).length;
  return brand > 1 ? "Zlavickovo" : null;
}

function stripOrigin(u: string, origin: string): string {
  return u.startsWith(origin) ? u.slice(origin.length) || "/" : u;
}

export interface AuditOptions {
  base: string;
  /** Doplnkové URL mimo sitemap (šablóny, parametre, expirované ponuky…). */
  extraPaths?: string[];
  concurrency?: number;
  maxPages?: number;
  /** Overiť status interných odkazov, ktoré nie sú v crawle (broken links). */
  checkLinks?: boolean;
  maxLinkChecks?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function runSeoAudit(opts: AuditOptions): Promise<AuditReport> {
  const startedAt = new Date().toISOString();
  const base = opts.base.replace(/\/+$/, "");
  const origin = new URL(base).origin;
  // Sitemap URL sú vždy absolútne na produkčnú doménu — pri lokálnom teste ich prepíšeme na base.
  const toBase = (u: string) => u.replace(/^https?:\/\/(www\.)?zlavickovo\.sk/i, base);

  const issues: AuditIssue[] = [];
  const add = (severity: Severity, code: string, url: string, detail: string) =>
    issues.push({ severity, code, url: stripOrigin(url, origin), detail });

  // robots.txt
  const robotsRes = await fetch(`${base}/robots.txt`, { headers: { "user-agent": UA } }).catch(() => null);
  const robotsTxt = robotsRes?.ok ? await robotsRes.text() : "";
  if (!robotsTxt) add("error", "robots_missing", "/robots.txt", "robots.txt nevracia 200");
  const disallows = [...robotsTxt.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
  for (const d of disallows) {
    if (/^\/_next\/?$|\.css|\.js|\/_next\/static|\/api\/img|\/_next\/image/i.test(d)) {
      add("error", "robots_blocks_assets", "/robots.txt", `Disallow ${d} blokuje zdroje potrebné na rendering`);
    }
  }
  if (!/^Sitemap:/im.test(robotsTxt)) add("warning", "robots_no_sitemap", "/robots.txt", "robots.txt neodkazuje na sitemap");

  // sitemap
  const sm = await fetchSitemapUrls(`${base}/sitemap.xml`, toBase);
  for (const e of sm.errors) add("error", "sitemap_error", "/sitemap.xml", e);
  const sitemapUrls = [...new Set(sm.urls.map(toBase))];
  if (sm.urls.length !== sitemapUrls.length) add("warning", "sitemap_duplicates", "/sitemap.xml", `${sm.urls.length - sitemapUrls.length} duplicitných URL v sitemap`);

  const extra = (opts.extraPaths ?? []).map((p) => (p.startsWith("http") ? p : `${base}${p}`));
  let targets = [...new Set([...sitemapUrls, ...extra])];
  if (opts.maxPages && targets.length > opts.maxPages) targets = targets.slice(0, opts.maxPages);

  let done = 0;
  const pages = await pool(targets, opts.concurrency ?? 8, async (u) => {
    const f = await fetchPage(u, origin);
    opts.onProgress?.(++done, targets.length);
    return f;
  });
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const sitemapSet = new Set(sitemapUrls);

  // Per-page kontroly
  for (const p of pages) {
    const inSitemap = sitemapSet.has(p.url);
    if (p.error) { add("error", "fetch_error", p.url, p.error); continue; }
    if (p.status >= 300 && p.status < 400) {
      if (inSitemap) add("error", "sitemap_redirect", p.url, `v sitemap, ale ${p.status} → ${p.redirectTo}`);
      if (p.redirectHops > 1) add("error", "redirect_chain", p.url, `${p.redirectHops} skoky presmerovania`);
      continue;
    }
    if (p.status === 404 || p.status === 410) {
      if (inSitemap) add("error", "sitemap_404", p.url, `v sitemap, ale HTTP ${p.status}`);
      continue;
    }
    if (p.status !== 200) { add("error", "bad_status", p.url, `HTTP ${p.status}`); continue; }

    if (!p.title) add("error", "missing_title", p.url, "chýba <title>");
    else {
      if (p.title.length > TITLE_MAX) add("info", "title_long", p.url, `${p.title.length} znakov: "${p.title}"`);
      const rep = hasRepeatedSegments(p.title);
      if (rep) add("error", "title_repeated_segment", p.url, `opakovaný segment "${rep}": "${p.title}"`);
    }
    if (p.indexable) {
      if (!p.description) add("warning", "missing_description", p.url, "chýba meta description");
      else if (p.description.length < DESC_MIN || p.description.length > DESC_MAX) {
        add("info", "description_length", p.url, `${p.description.length} znakov`);
      }
      if (p.h1.length === 0) add("error", "missing_h1", p.url, "chýba H1");
      if (p.h1.length > 1) add("warning", "multiple_h1", p.url, `${p.h1.length}× H1`);
      if (!p.canonical) add("error", "missing_canonical", p.url, "indexovateľná stránka bez canonical");
      else if (toBase(p.canonical) !== p.url) {
        add("warning", "canonical_mismatch", p.url, `canonical → ${p.canonical}`);
      }
      if (p.textLength < THIN_TEXT) add("warning", "thin_page", p.url, `len ${p.textLength} znakov viditeľného textu`);
      else if (p.activeOffers === 0) add("warning", "thin_page", p.url, "indexovateľná, ale 0 aktívnych ponúk (povolené len pre kurátorské TOP obchody)");
    }
    if (inSitemap && !p.indexable) add("error", "sitemap_noindex", p.url, `v sitemap, ale robots="${p.robots}"`);
    if (inSitemap && p.canonical && toBase(p.canonical) !== p.url) add("error", "sitemap_not_canonical", p.url, `v sitemap, ale canonical → ${p.canonical}`);
    if (p.canonical && p.canonical.includes("?") && /utm_|gclid|fbclid|sort=|q=/.test(p.canonical)) {
      add("error", "canonical_has_params", p.url, `canonical s parametrami: ${p.canonical}`);
    }
    if (p.canonical && /[A-Z]/.test(new URL(p.canonical).pathname)) add("error", "canonical_uppercase", p.url, p.canonical);
    for (const e of p.jsonLdErrors) add("error", "structured_data", p.url, e);
    if (p.imagesWithoutAlt > 0) add("warning", "img_missing_alt", p.url, `${p.imagesWithoutAlt} obrázkov bez alt`);
    if (p.offerExpired && p.indexable) {
      add("error", "expired_indexed", p.url, "ukončená akcia je indexovateľná");
    }
  }

  // Duplicity title/description medzi indexovateľnými stránkami
  const indexable = pages.filter((p) => p.status === 200 && p.indexable);
  // Duplicity len medzi kanonickými URL (varianta s ?utm_ s canonical na originál nie je duplikát).
  const canonicalPages = indexable.filter((p) => !p.canonical || toBase(p.canonical) === p.url);
  const dup = (key: "title" | "description", code: string) => {
    const groups = new Map<string, string[]>();
    for (const p of canonicalPages) {
      const v = p[key];
      if (!v) continue;
      groups.set(v, [...(groups.get(v) ?? []), p.url]);
    }
    for (const [v, urls] of groups) {
      if (urls.length > 1) add(key === "title" ? "error" : "warning", code, urls[0], `${urls.length}× "${v.slice(0, 90)}" — ${urls.slice(1, 4).map((u) => stripOrigin(u, origin)).join(", ")}${urls.length > 4 ? "…" : ""}`);
    }
  };
  dup("title", "duplicate_title");
  dup("description", "duplicate_description");

  // Interné odkazy: broken links + orphan pages
  const inbound = new Map<string, number>();
  const linkTargets = new Set<string>();
  for (const p of pages) {
    for (const l of p.internalLinks) {
      const abs = `${base}${l}`;
      if (abs !== p.url) inbound.set(abs, (inbound.get(abs) ?? 0) + 1);
      linkTargets.add(abs);
    }
  }
  for (const u of sitemapUrls) {
    if (u === base || u === `${base}/`) continue;
    if (!inbound.get(u)) add("warning", "orphan_page", u, "v sitemap, ale žiadna prelezená stránka naň neodkazuje");
  }

  if (opts.checkLinks !== false) {
    const unknown = [...linkTargets].filter((u) => !byUrl.has(u) && !/\/(api|admin)\//.test(u)).slice(0, opts.maxLinkChecks ?? 400);
    const checked = await pool(unknown, opts.concurrency ?? 8, (u) => fetchPage(u, origin));
    for (const c of checked) {
      byUrl.set(c.url, c);
      if (c.status === 404 || c.status === 410 || c.status >= 500 || c.error) {
        const from = pages.filter((p) => p.internalLinks.includes(stripOrigin(c.url, origin))).slice(0, 3).map((p) => stripOrigin(p.url, origin));
        add("error", "broken_internal_link", c.url, `HTTP ${c.status || c.error} — odkazuje ${from.join(", ")}`);
      } else if (c.redirectHops > 1) {
        add("error", "redirect_chain", c.url, `${c.redirectHops} skoky presmerovania (interný odkaz)`);
      } else if (c.status >= 300 && c.status < 400) {
        add("info", "internal_link_redirect", c.url, `interný odkaz vedie na ${c.status} → ${c.redirectTo}`);
      }
    }
  }

  const count = (code: string) => issues.filter((i) => i.code === code).length;
  const all = [...byUrl.values()];
  const summary: Record<string, number> = {
    crawled: pages.length,
    sitemapUrls: sitemapUrls.length,
    sitemapFiles: sm.files.length,
    indexable: indexable.length,
    noindex: pages.filter((p) => p.status === 200 && !p.indexable).length,
    status404: all.filter((p) => p.status === 404 || p.status === 410).length,
    redirects: all.filter((p) => p.status >= 300 && p.status < 400).length,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    missingTitle: count("missing_title"),
    duplicateTitles: count("duplicate_title"),
    duplicateDescriptions: count("duplicate_description"),
    missingH1: count("missing_h1"),
    canonicalMismatch: count("canonical_mismatch") + count("sitemap_not_canonical"),
    sitemapErrors: count("sitemap_error") + count("sitemap_404") + count("sitemap_redirect") + count("sitemap_noindex"),
    brokenLinks: count("broken_internal_link"),
    redirectChains: count("redirect_chain"),
    orphanPages: count("orphan_page"),
    thinPages: count("thin_page"),
    expiredIndexed: count("expired_indexed"),
    structuredDataErrors: count("structured_data"),
  };

  const sevOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.code.localeCompare(b.code));

  return {
    base,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary,
    issues,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pages: pages.map(({ internalLinks: _l, ...rest }) => ({ ...rest, url: stripOrigin(rest.url, origin) })),
  };
}
