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

export async function POST(req: NextRequest) {
  // 1) Autorizácia
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
