const HEUREKA_SEARCH_BASE_URL = "https://www.heureka.sk/";
const HEUREKA_HOSTS = new Set(["heureka.sk", "www.heureka.sk"]);

export type HeurekaUrlOptions = {
  affiliateId?: string | null;
};

export function cleanHeurekaAffiliateId(affiliateId: string | null | undefined): string | undefined {
  const clean = affiliateId?.trim();
  return clean || undefined;
}

function parseSafeHeurekaUrl(destinationUrl: string): URL {
  try {
    const url = new URL(destinationUrl);
    if (HEUREKA_HOSTS.has(url.hostname.toLowerCase())) return url;
  } catch {}

  return new URL(HEUREKA_SEARCH_BASE_URL);
}

export function buildHeurekaUrl(destinationUrl = HEUREKA_SEARCH_BASE_URL, options?: HeurekaUrlOptions): string {
  const url = parseSafeHeurekaUrl(destinationUrl);
  const affiliateId = cleanHeurekaAffiliateId(options?.affiliateId);

  url.searchParams.delete("positionid");
  url.searchParams.delete("haff");

  if (affiliateId) {
    url.searchParams.set("haff", affiliateId);
  }

  url.searchParams.set("utm_source", "zlavickovo");
  url.searchParams.set("utm_medium", "affiliate");

  return url.toString();
}

export function buildHeurekaSearchUrl(query: string, options?: HeurekaUrlOptions): string {
  const url = new URL(HEUREKA_SEARCH_BASE_URL);
  const cleanQuery = query.trim();

  if (cleanQuery) {
    // Aktuálny vyhľadávací parameter Heureky je h[fraze] (starý h[frm][q] sa
    // ignoruje → odkaz padol na homepage). Overené na www.heureka.sk formulári.
    url.searchParams.set("h[fraze]", cleanQuery);
  }

  return buildHeurekaUrl(url.toString(), options);
}
