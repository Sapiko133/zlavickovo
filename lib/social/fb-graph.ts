/**
 * Oficiálne Meta Graph API volania (žiadny scraping/workaround).
 * Token sa nikdy neloguje; chybové správy prechádzajú cez safeErrorMessage.
 */

export interface FacebookConfig {
  pageId?: string;
  accessToken?: string;
  version: string;
  enabled: boolean;
  /** FACEBOOK_DRY_RUN=1 → plánuje sa, ale nikdy nepublikuje. */
  dryRun: boolean;
}

export function facebookConfig(): FacebookConfig {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v26.0";
  return {
    pageId,
    accessToken,
    version,
    enabled: Boolean(pageId && accessToken),
    dryRun: process.env.FACEBOOK_DRY_RUN === "1",
  };
}

export class GraphError extends Error {
  readonly code?: number;
  readonly status?: number;
  /** Nejasný výsledok (timeout/sieť) — post mohol vzniknúť, nesmie sa slepo opakovať. */
  readonly ambiguous: boolean;
  readonly retryable: boolean;
  constructor(message: string, opts: { code?: number; status?: number; ambiguous?: boolean; retryable?: boolean }) {
    super(message);
    this.name = "GraphError";
    this.code = opts.code;
    this.status = opts.status;
    this.ambiguous = Boolean(opts.ambiguous);
    this.retryable = Boolean(opts.retryable);
  }
}

/** Graph error kódy, pri ktorých má zmysel neskorší retry (dočasné/limitné). */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);

interface GraphResponse {
  id?: string;
  post_id?: string;
  data?: Array<{ id: string; message?: string; created_time?: string }>;
  error?: { message?: string; code?: number };
}

async function graphFetch(url: string, init: RequestInit, label: string): Promise<GraphResponse> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    // Request mohol doraziť na Meta server — výsledok nepoznáme.
    throw new GraphError(`${label}: ${(e as Error)?.name === "TimeoutError" ? "timeout" : "sieťová chyba"}`, { ambiguous: true, retryable: true });
  }
  const data = (await response.json().catch(() => ({}))) as GraphResponse;
  if (!response.ok || data.error) {
    const code = data.error?.code;
    const retryable = response.status >= 500 || (code != null && RETRYABLE_CODES.has(code));
    throw new GraphError(`${label}: ${data.error?.message || `HTTP ${response.status}`}${code ? ` (${code})` : ""}`, {
      code,
      status: response.status,
      // 5xx po POST môže byť nejasný stav
      ambiguous: response.status >= 500,
      retryable,
    });
  }
  return data;
}

export async function publishPhotoPost(cfg: FacebookConfig, input: { imageUrl: string; caption: string }): Promise<string> {
  if (!cfg.enabled || !cfg.pageId || !cfg.accessToken) throw new GraphError("Facebook nie je nakonfigurovaný.", { retryable: false });
  const body = new URLSearchParams({ url: input.imageUrl, caption: input.caption, access_token: cfg.accessToken });
  const data = await graphFetch(
    `https://graph.facebook.com/${encodeURIComponent(cfg.version)}/${encodeURIComponent(cfg.pageId)}/photos`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    "Facebook publish",
  );
  const postId = data.post_id || data.id;
  if (!postId) throw new GraphError("Facebook API nevrátilo ID príspevku.", { ambiguous: true, retryable: false });
  return postId;
}

/**
 * Overí, či post s daným textom už na stránke existuje (po páde/timeoute).
 * Vráti ID postu, null keď neexistuje; vyhodí, keď sa overiť nedá.
 */
export async function findPublishedPost(cfg: FacebookConfig, input: { textPrefix: string; since: number }): Promise<string | null> {
  if (!cfg.enabled || !cfg.pageId || !cfg.accessToken) throw new GraphError("Facebook nie je nakonfigurovaný.", { retryable: false });
  const qs = new URLSearchParams({
    fields: "id,message,created_time",
    limit: "25",
    since: String(Math.floor(input.since / 1000)),
    access_token: cfg.accessToken,
  });
  const data = await graphFetch(
    `https://graph.facebook.com/${encodeURIComponent(cfg.version)}/${encodeURIComponent(cfg.pageId)}/published_posts?${qs}`,
    { method: "GET" },
    "Facebook verify",
  );
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const prefix = norm(input.textPrefix);
  const hit = (data.data ?? []).find((p) => p.message && norm(p.message).startsWith(prefix));
  return hit?.id ?? null;
}
