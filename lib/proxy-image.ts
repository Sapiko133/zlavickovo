/**
 * Prepíše obrázkové URL, ktoré blokujú cross-origin hotlink, na náš server-side
 * proxy `/api/img?u=...`. Ostatné URL (favicony, og:image, api.app.dognet.com logá)
 * vraciame nezmenené — tie sa načítajú priamo.
 *
 * Blokujúci host: Dognet bannerový host `login.dognet.sk` (vracia 503 pri embede
 * z cudzej domény). Viď app/api/img/route.ts.
 */

const PROXY_HOSTS = ["login.dognet.sk"];

export function proxyImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (PROXY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return `/api/img?u=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}
