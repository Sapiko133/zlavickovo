import { getAllArticles, getArticleBySlug, type Article } from "@/lib/articles";
import { redis } from "@/lib/redis";

const PENDING_KEY = "facebook:pending-actions";
const POSTED_KEY = "facebook:posted-actions";
const SITE_URL = "https://www.zlavickovo.sk";
const FALLBACK_COOLDOWN_DAYS = 30;

type PendingMode = "new" | "fallback";

interface FacebookApiResponse {
  id?: string;
  post_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export interface FacebookPublishResult {
  enabled: boolean;
  pending: number;
  published: Array<{ slug: string; postId: string }>;
  failed: Array<{ slug: string; error: string }>;
}

function facebookConfig() {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v26.0";
  return { pageId, accessToken, version, enabled: Boolean(pageId && accessToken) };
}

function formatValidity(validTo?: string | null): string {
  if (!validTo) return "Ponuka je aktuálna do odvolania.";
  const date = new Date(validTo);
  return Number.isNaN(date.getTime())
    ? "Platnosť si over priamo v obchode."
    : `Platí do ${date.toLocaleDateString("sk-SK")}.`;
}

export function buildFacebookCaption(article: Article): string {
  const pageUrl = `${SITE_URL}/akcie/${encodeURIComponent(article.slug)}`;
  const discount = article.discountPct ? ` Zľava až -${article.discountPct} %.` : "";
  const summary = article.perex.replace(/\s+/g, " ").trim().slice(0, 260);
  return [
    `🔥 ${article.title}`,
    `${summary}${discount}`,
    formatValidity(article.validTo),
    `👉 Detaily akcie: ${pageUrl}`,
    "#zlavy #akcie #zlavickovo",
  ].join("\n\n");
}

export async function queueFacebookArticles(slugs: string[]): Promise<number> {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  if (unique.length === 0) return 0;
  const queuedAt = new Date().toISOString();
  await redis.hset(PENDING_KEY, Object.fromEntries(unique.map((slug) => [slug, queuedAt])));
  return unique.length;
}

function pendingMode(value: unknown): PendingMode {
  if (typeof value !== "string") return "new";
  try {
    return JSON.parse(value)?.mode === "fallback" ? "fallback" : "new";
  } catch {
    return "new";
  }
}

function publishedAt(value: unknown): number {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const timestamp = Date.parse((parsed as { publishedAt?: string } | null)?.publishedAt || "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
  } catch {
    return 0;
  }
}

function isActiveAffiliateAction(article: Article, now: number): boolean {
  if (!article.published || article.type !== "sale" || article.origin !== "affiliate-action") return false;
  if (!article.validTo) return true;
  const validTo = Date.parse(article.validTo);
  return Number.isNaN(validTo) || validTo >= now;
}

export async function queueFacebookFallbackArticles(count = 2): Promise<number> {
  const pending = await redis.hgetall<Record<string, unknown>>(PENDING_KEY).catch(() => null);
  if (Object.keys(pending || {}).length > 0) return 0;

  const now = Date.now();
  const cooldownMs = FALLBACK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const posted = await redis.hgetall<Record<string, unknown>>(POSTED_KEY).catch(() => null);
  const articles = await getAllArticles();
  const selected = articles
    .filter((article) => isActiveAffiliateAction(article, now))
    .filter((article) => {
      const lastPublished = publishedAt(posted?.[article.slug]);
      return lastPublished === 0 || now - lastPublished >= cooldownMs;
    })
    .sort((a, b) => {
      const byOldestPost = publishedAt(posted?.[a.slug]) - publishedAt(posted?.[b.slug]);
      return byOldestPost || b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, Math.max(0, count));

  if (selected.length === 0) return 0;
  const queuedAt = new Date(now).toISOString();
  await redis.hset(
    PENDING_KEY,
    Object.fromEntries(selected.map((article) => [article.slug, JSON.stringify({ queuedAt, mode: "fallback" })])),
  );
  return selected.length;
}

async function publishPhoto(article: Article): Promise<string> {
  const config = facebookConfig();
  if (!config.enabled || !config.pageId || !config.accessToken) {
    throw new Error("Facebook nie je nakonfigurovaný.");
  }

  const imageUrl = `${SITE_URL}/akcie/${encodeURIComponent(article.slug)}/opengraph-image`;
  const body = new URLSearchParams({
    url: imageUrl,
    caption: buildFacebookCaption(article),
    access_token: config.accessToken,
  });
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(config.version)}/${encodeURIComponent(config.pageId)}/photos`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  const data = await response.json().catch(() => ({})) as FacebookApiResponse;
  if (!response.ok || data.error) {
    const code = data.error?.code ? ` (${data.error.code})` : "";
    throw new Error(`${data.error?.message || `Facebook API HTTP ${response.status}`}${code}`);
  }
  const postId = data.post_id || data.id;
  if (!postId) throw new Error("Facebook API nevrátilo ID príspevku.");
  return postId;
}

export async function publishPendingFacebookActions(): Promise<FacebookPublishResult> {
  const config = facebookConfig();
  const pendingMap = await redis.hgetall<Record<string, string>>(PENDING_KEY).catch(() => null);
  const pendingEntries = Object.entries(pendingMap || {}).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const result: FacebookPublishResult = {
    enabled: config.enabled,
    pending: pendingEntries.length,
    published: [],
    failed: [],
  };
  if (!config.enabled || pendingEntries.length === 0) return result;

  const configuredLimit = Number(process.env.FACEBOOK_POST_LIMIT || 3);
  const limit = Number.isFinite(configuredLimit) ? Math.min(10, Math.max(1, configuredLimit)) : 3;

  for (const [slug, pendingValue] of pendingEntries.slice(0, limit)) {
    try {
      const mode = pendingMode(pendingValue);
      const alreadyPosted = await redis.hget<unknown>(POSTED_KEY, slug);
      const recentlyPosted = Date.now() - publishedAt(alreadyPosted) < FALLBACK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (alreadyPosted && (mode === "new" || recentlyPosted)) {
        await redis.hdel(PENDING_KEY, slug);
        continue;
      }
      const article = await getArticleBySlug(slug);
      if (!article || !isActiveAffiliateAction(article, Date.now())) {
        await redis.hdel(PENDING_KEY, slug);
        continue;
      }
      const postId = await publishPhoto(article);
      await redis.hset(POSTED_KEY, {
        [slug]: JSON.stringify({ postId, publishedAt: new Date().toISOString(), mode }),
      });
      await redis.hdel(PENDING_KEY, slug);
      result.published.push({ slug, postId });
    } catch (error: unknown) {
      result.failed.push({
        slug,
        error: error instanceof Error ? error.message : "Neznáma chyba Facebook publikovania.",
      });
    }
  }

  result.pending = Math.max(0, pendingEntries.length - result.published.length);
  return result;
}
