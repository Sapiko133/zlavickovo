import { redis } from "@/lib/redis";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { FEEDS } from "@/lib/feeds/AffialFeedProvider";

export interface AffialFeedEntry {
  url: string;
  domain: string;
  category: string;
}

const FEEDS_KEY = "affial:feed_urls";
const AFFIAL_BASE = "https://login.affial.com";

// --- Pattern-based discovery for known shop domains ---

const PATTERNS = [
  (d: string) => `https://www.${d}/heureka/export/products.xml`,
  (d: string) => `https://${d}/heureka/export/products.xml`,
  (d: string) => `https://www.${d}/export/heureka.xml`,
  (d: string) => `https://${d}/export/heureka.xml`,
  (d: string) => `https://www.${d}/google/export/products.xml`,
  (d: string) => `https://${d}/google/export/products.xml`,
  (d: string) => `https://www.${d}/feed/heureka`,
  (d: string) => `https://${d}/feed/heureka`,
];

async function testUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Zlavickovo/1.0 feed-discovery" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function discoverFromPatterns(): Promise<{ found: number; saved: number }> {
  const existingDomains = new Set(FEEDS.map((f) => f.domain));
  const missing = AFFIAL_SHOPS.filter((s) => !existingDomains.has(s.domain));

  const discovered: AffialFeedEntry[] = [];

  await Promise.all(
    missing.map(async (shop) => {
      for (const pattern of PATTERNS) {
        const url = pattern(shop.domain);
        const ok = await testUrl(url);
        if (ok) {
          discovered.push({ url, domain: shop.domain, category: shop.category });
          break;
        }
      }
    })
  );

  if (discovered.length === 0) return { found: 0, saved: 0 };

  const existing = (await redis.get<AffialFeedEntry[]>(FEEDS_KEY)) ?? [];
  const existingUrls = new Set(existing.map((e) => e.url));
  const newEntries = discovered.filter((e) => !existingUrls.has(e.url));
  if (newEntries.length > 0) await redis.set(FEEDS_KEY, [...existing, ...newEntries]);

  return { found: discovered.length, saved: newEntries.length };
}

// --- Login-based discovery (PAP panel scraping) ---

async function papLogin(): Promise<string | null> {
  const email = process.env.AFFIAL_EMAIL;
  const password = process.env.AFFIAL_PASSWORD;
  if (!email || !password) return null;

  try {
    // Try form POST — standard PAP affiliate login
    const res = await fetch(`${AFFIAL_BASE}/affiliates/login.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: "text/html,application/xhtml+xml",
      },
      body: new URLSearchParams({
        USERNAME: email,
        PASSWORD: password,
        Submit: "Login",
      }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });

    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/(PAPsession|PHPSESSID|session)[^;]*/i);
    if (match) return match[0];

    // Some PAP versions return 200 with a JS redirect; try to grab any session cookie
    if (setCookie) return setCookie.split(";")[0];
    return null;
  } catch {
    return null;
  }
}

function extractFeedUrls(html: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /https?:\/\/[^\s"'<>]+\.xml[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*\/(?:heureka|export|feeds?|xml)\/[^\s"'<>]*/gi,
    /https?:\/\/feeds\.mergado\.com\/[^\s"'<>]*/gi,
    /https?:\/\/exports\.conviu\.com\/[^\s"'<>]*/gi,
  ];
  for (const p of patterns) {
    for (const m of html.matchAll(p)) {
      const url = m[0].replace(/['"<>]+$/, "");
      if (!url.includes(AFFIAL_BASE)) found.add(url);
    }
  }
  return Array.from(found);
}

async function fetchWithSession(url: string, cookie: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function discoverFromLogin(): Promise<{ found: number; saved: number; error?: string }> {
  if (!process.env.AFFIAL_EMAIL || !process.env.AFFIAL_PASSWORD) {
    return { found: 0, saved: 0, error: "Chýbajú env premenné AFFIAL_EMAIL a AFFIAL_PASSWORD" };
  }

  const cookie = await papLogin();
  if (!cookie) {
    return { found: 0, saved: 0, error: "Prihlásenie zlyhalo — skontroluj prihlasovacie údaje" };
  }

  const panelUrls = [
    `${AFFIAL_BASE}/affiliates/panel.php?PanelId=productfeed`,
    `${AFFIAL_BASE}/affiliates/panel.php?PanelId=productfeeds`,
    `${AFFIAL_BASE}/affiliates/panel.php`,
  ];

  let allUrls: string[] = [];
  for (const url of panelUrls) {
    const html = await fetchWithSession(url, cookie);
    if (html) {
      const urls = extractFeedUrls(html);
      if (urls.length > 0) {
        allUrls = urls;
        break;
      }
    }
  }

  if (allUrls.length === 0) {
    return { found: 0, saved: 0, error: "Panel prístupný, ale žiadne URL feedov nenájdené — panel môže vyžadovať JS rendering" };
  }

  const entries: AffialFeedEntry[] = allUrls.map((url) => ({
    url,
    domain: guessDomain(url),
    category: "ine",
  }));

  const existing = (await redis.get<AffialFeedEntry[]>(FEEDS_KEY)) ?? [];
  const existingUrls = new Set(existing.map((e) => e.url));
  const newEntries = entries.filter((e) => !existingUrls.has(e.url));
  if (newEntries.length > 0) await redis.set(FEEDS_KEY, [...existing, ...newEntries]);

  return { found: allUrls.length, saved: newEntries.length };
}

// --- Manual save ---

export async function saveManualFeeds(urls: string[]): Promise<number> {
  const existing = (await redis.get<AffialFeedEntry[]>(FEEDS_KEY)) ?? [];
  const existingUrls = new Set(existing.map((e) => e.url));
  const newEntries: AffialFeedEntry[] = urls
    .filter((u) => u.startsWith("http") && !existingUrls.has(u))
    .map((u) => ({ url: u, domain: guessDomain(u), category: "ine" }));
  if (newEntries.length > 0) await redis.set(FEEDS_KEY, [...existing, ...newEntries]);
  return newEntries.length;
}

export async function getCustomFeeds(): Promise<AffialFeedEntry[]> {
  return (await redis.get<AffialFeedEntry[]>(FEEDS_KEY)) ?? [];
}

export async function deleteCustomFeed(url: string): Promise<void> {
  const existing = (await redis.get<AffialFeedEntry[]>(FEEDS_KEY)) ?? [];
  await redis.set(FEEDS_KEY, existing.filter((e) => e.url !== url));
}

export async function clearCustomFeeds(): Promise<void> {
  await redis.del(FEEDS_KEY);
}

function guessDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
