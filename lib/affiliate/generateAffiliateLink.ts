// DEPRECATED: tento súbor sa aktívne nepoužíva — tracking cez dognet.ts (channel 33415)
const DOGNET_CHANNEL = process.env.DOGNET_AD_CHANNEL_ID || "33415";

function dognetLink(url: string): string {
  return `https://www.dognet.sk/out/${DOGNET_CHANNEL}?url=${encodeURIComponent(url)}`;
}

function heurekaLink(url: string): string {
  return `${url}?utm_source=zlavickovo&utm_medium=referral&positionid=71010`;
}

function awinLink(url: string): string {
  // TODO: Doplniť AWIN publisher ID a program ID
  // Format: https://www.awin1.com/cread.php?awinmid={PROGRAM_ID}&awinaffid={PUBLISHER_ID}&clickref=&p={url}
  const publisherId = process.env.AWIN_PUBLISHER_ID || "";
  if (!publisherId) return url;
  return `https://www.awin1.com/cread.php?awinaffid=${publisherId}&p=${encodeURIComponent(url)}`;
}

function cjLink(url: string): string {
  // TODO: Doplniť CJ website ID a program ID
  // Format: https://www.anrdoezrs.net/click-{WEBSITE_ID}-{PROGRAM_ID}?url={url}
  return url;
}

export function generateAffiliateLink(url: string, source: string): string {
  switch (source) {
    case "dognet":  return dognetLink(url);
    case "awin":    return awinLink(url);
    case "cj":      return cjLink(url);
    case "heureka": return heurekaLink(url);
    default:        return url;
  }
}
