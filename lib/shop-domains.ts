const DOMAIN_MAP: Record<string, string> = {
  // SK obchody
  "alza": "alza.sk",
  "mall": "mall.sk",
  "notino": "notino.sk",
  "sportisimo": "sportisimo.sk",
  "dedoles": "dedoles.com",
  "martinus": "martinus.sk",
  "answear": "answear.sk",
  "dr. max": "drmax.sk",
  "dr max": "drmax.sk",
  "dr-max": "drmax.sk",
  "billa": "billa.sk",
  "lidl": "lidl.sk",
  "kaufland": "kaufland.sk",
  "tesco": "tesco.sk",
  "tchibo": "tchibo.sk",
  "decathlon": "decathlon.sk",
  "bonprix": "bonprix.sk",
  "vivantis": "vivantis.sk",
  "4home": "4home.sk",
  "eobuv": "eobuv.sk",
  "ccc": "ccc.eu",
  "obi": "obi.sk",
  "datart": "datart.sk",
  "nay": "nay.sk",
  "okay": "okay.sk",
  "planeo": "planeo.sk",
  "electro world": "electroworld.sk",
  "dm": "dm.sk",

  // Medzinárodné
  "zalando": "zalando.sk",
  "shein": "shein.com",
  "ikea": "ikea.com",
  "zara": "zara.com",
  "h&m": "hm.com",
  "hm": "hm.com",
  "h m": "hm.com",
  "asos": "asos.com",
  "about you": "aboutyou.sk",
  "about-you": "aboutyou.sk",
  "adidas": "adidas.com",
  "nike": "nike.com",
  "reebok": "reebok.com",
  "puma": "puma.com",
  "samsung": "samsung.com",
  "apple": "apple.com",
  "lenovo": "lenovo.com",
  "hp": "hp.com",
  "dell": "dell.com",
  "amazon": "amazon.de",
  "aliexpress": "aliexpress.com",
  "ebay": "ebay.com",
  "booking.com": "booking.com",
  "airbnb": "airbnb.com",
};

export function getShopDomain(name: string): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (DOMAIN_MAP[key]) return DOMAIN_MAP[key];

  // Try first word (e.g. "Zalando SK" → "zalando")
  const firstWord = key.split(/\s+/)[0];
  if (DOMAIN_MAP[firstWord]) return DOMAIN_MAP[firstWord];

  // Try slug form (hyphens → spaces)
  const deHyphen = key.replace(/-/g, " ");
  if (DOMAIN_MAP[deHyphen]) return DOMAIN_MAP[deHyphen];

  return null;
}
