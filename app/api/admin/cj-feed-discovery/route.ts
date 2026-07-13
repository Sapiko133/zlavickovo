import { NextRequest } from "next/server";
import {
  discoverFeeds,
  getCjProductCredentials,
  MAX_PRODUCTS_PER_FEED,
  MAX_PRODUCTS_PER_REQUEST,
  CjApiError,
} from "@/lib/cj-product-feed";
import { getJoinedCjAdvertiserIds } from "@/lib/cj";

export const dynamic = "force-dynamic";
// Vzorkovanie viacerých feedov (25/feed) môže trvať dlhšie — drž sa route stropu.
export const maxDuration = 300;

/**
 * CJ Product Feed discovery (Fáza CJ-1) — read-only audit dostupných feedov.
 *   - iba POST
 *   - Authorization: Bearer <CRON_SECRET>
 *   - bez CJ produktových credentials → bezpečný 503
 *   - CJ API auth/chyba → bezpečný 502
 *   - NIČ nezapisuje do DB ani Redis; token sa nikdy nevypíše
 *
 * Query parametre (voliteľné, clampované):
 *   checkpoint — index feedu na pokračovanie (default 0)
 *   maxFeeds   — strop feedov na request (1..40, default 40)
 */
function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * Autorizácia proti CRON_SECRET — rovnaká schéma ako /api/cron/import-heureka,
 * /api/admin/heureka-migrate a /api/admin/price-history-cleanup
 * (Authorization: Bearer <CRON_SECRET>).
 *
 * Jediný rozdiel oproti tým routám: okraje env hodnoty aj prijatého tokenu sa
 * TRIMNÚ. Striktné porovnanie `authHeader !== \`Bearer ${secret}\`` bez trimu je
 * krehké — jediný trailing newline/medzera (napr. pri vložení secretu do Vercel
 * env alebo do shell premennej `Bearer $(cat secret)`) spôsobí falošný 401,
 * hoci hodnota je inak správna. Toto bola príčina 401 v produkcii.
 *
 * Diagnostika NIKDY neobsahuje hodnotu secretu, jeho časť, hash ani CJ token —
 * iba boolean/dĺžky, ktoré nič neprezradia.
 */
type AuthResult = { ok: true } | { ok: false; response: Response };

function authorizeCron(req: NextRequest): AuthResult {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const authHeader = req.headers.get("authorization");
  const bearerPrefixPresent = authHeader?.startsWith("Bearer ") ?? false;
  const receivedToken = bearerPrefixPresent
    ? authHeader!.slice("Bearer ".length).trim()
    : "";

  if (secret.length > 0 && receivedToken === secret) {
    return { ok: true };
  }

  return {
    ok: false,
    response: Response.json(
      {
        ok: false,
        error: "unauthorized",
        diagnostics: {
          authorizationHeaderPresent: authHeader !== null,
          bearerPrefixPresent,
          cronSecretConfigured: secret.length > 0,
          receivedTokenLength: receivedToken.length,
          expectedTokenLength: secret.length,
        },
      },
      { status: 401 }
    ),
  };
}

export async function POST(req: NextRequest) {
  // 1) Autorizácia (Bearer CRON_SECRET, trimované okraje — pozri authorizeCron)
  const auth = authorizeCron(req);
  if (!auth.ok) return auth.response;

  // 2) CJ produktové credentials (NIE CJ_API_KEY/CJ_WEBSITE_ID)
  const creds = getCjProductCredentials();
  if (!creds) {
    return Response.json(
      {
        ok: false,
        error:
          "CJ product feed credentials missing (CJ_PERSONAL_ACCESS_TOKEN + CJ_COMPANY_ID)",
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const maxFeedCeil = Math.floor(MAX_PRODUCTS_PER_REQUEST / MAX_PRODUCTS_PER_FEED); // 40
    const checkpoint = clampInt(searchParams.get("checkpoint"), 0, 0, 1_000_000);
    const maxFeeds = clampInt(searchParams.get("maxFeeds"), maxFeedCeil, 1, maxFeedCeil);

    // Read-only cross-check joined vzťahu z existujúcej CJ shops cache (bez zápisu).
    const joined = await getJoinedCjAdvertiserIds();
    if (!joined.available) {
      // Zdroj joinov je nedostupný (cache miss / Redis chyba). Discovery NESMIE
      // pokračovať s prázdnym filtrom — vrátil by falošný ok=true, totalFeeds=0,
      // hoci publisher môže mať aktívnych CJ advertiserov. Bezpečný 503.
      return Response.json(
        { ok: false, error: "joinedAdvertisersUnavailable" },
        { status: 503 }
      );
    }

    const result = await discoverFeeds({
      token: creds.token,
      companyId: creds.companyId,
      checkpoint,
      maxFeeds,
      joinedAdvertiserIds: joined.ids,
    });

    return Response.json(result);
  } catch (err) {
    // CJ auth/GraphQL/network chyba → 502; nikdy nevypisuj token ani secret.
    if (err instanceof CjApiError) {
      console.error("[cj-feed-discovery]", err.kind, err.message);
      return Response.json(
        { ok: false, error: "CJ product feed API request failed", kind: err.kind },
        { status: 502 }
      );
    }
    console.error("[cj-feed-discovery]", (err as Error)?.message ?? err);
    return Response.json(
      { ok: false, error: "CJ feed discovery failed" },
      { status: 500 }
    );
  }
}
