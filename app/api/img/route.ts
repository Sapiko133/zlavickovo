/**
 * Server-side image proxy pre banner kreatívy, ktoré blokujú cross-origin hotlink.
 *
 * Dôvod: Dognet bannerový host `login.dognet.sk` vracia HTTP 503 pre `<img>`
 * requesty embednuté z cudzej domény (zlavickovo.sk), ale server-side fetch
 * (bez browser Sec-Fetch/Origin signálov) prejde 200. Túto routu preto voláme
 * z klienta (`/api/img?u=...`), obrázok načítame na serveri a pošleme ho z našej
 * domény — Vercel CDN ho nakešuje, takže Dognet dostane max. 1 request na obrázok.
 *
 * SSRF ochrana: proxujeme LEN whitelistované hosty (žiadne ľubovoľné URL).
 */

export const runtime = "nodejs";

// Povolené image hosty (suffix match). Držíme úzko — nie univerzálny proxy.
const ALLOWED_HOST_SUFFIXES = [".dognet.sk", ".dognet.com", "dognet.sk", "dognet.com"];

const UPSTREAM_TIMEOUT_MS = 8000;
// Bannery sú nemenné (unikátny hash v ceste) → dlhý immutable cache na CDN.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400, immutable";

function isAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(s));
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !isAllowed(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // Browser-like UA — niektoré hosty odmietajú prázdny/neznámy UA.
        "User-Agent": "Mozilla/5.0 (compatible; ZlavickovoBot/1.0; +https://www.zlavickovo.sk)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const ct = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !ct.startsWith("image/")) {
      // Nech klientský onError spustí fallback na favicon.
      return new Response("upstream error", { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": CACHE_CONTROL,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
