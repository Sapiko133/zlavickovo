const SHOP_LIST: Array<{ names: string[]; slug: string }> = [
  { names: ["alza"], slug: "alza" },
  { names: ["zalando"], slug: "zalando" },
  { names: ["shein"], slug: "shein" },
  { names: ["mall", "mall.sk", "mall.cz"], slug: "mall" },
  { names: ["notino"], slug: "notino" },
  { names: ["sportisimo"], slug: "sportisimo" },
  { names: ["ikea"], slug: "ikea" },
  { names: ["dedoles"], slug: "dedoles" },
  { names: ["martinus"], slug: "martinus" },
  { names: ["gymbeam", "gym beam"], slug: "gymbeam" },
  { names: ["dr max", "dr. max", "drmax"], slug: "dr-max" },
  { names: ["lidl"], slug: "lidl" },
  { names: ["kaufland"], slug: "kaufland" },
  { names: ["tesco"], slug: "tesco" },
  { names: ["billa"], slug: "billa" },
  { names: ["booking", "booking.com"], slug: "booking-com" },
  { names: ["superstrava", "superstrava.sk"], slug: "superstrava-sk" },
  { names: ["blendea"], slug: "blendea-sk" },
  { names: ["kosmetikomat"], slug: "kosmetikomat-sk" },
  { names: ["vimax", "vimax.sk"], slug: "vimax-sk" },
  { names: ["herbatica"], slug: "herbatica-sk" },
  { names: ["datart"], slug: "datart" },
  { names: ["nay"], slug: "nay" },
  { names: ["okay", "okay.sk"], slug: "okay" },
  { names: ["samsung"], slug: "samsung" },
  { names: ["asos"], slug: "asos" },
  { names: ["about you", "aboutyou"], slug: "about-you" },
  { names: ["answear"], slug: "answear" },
  { names: ["zara"], slug: "zara" },
  { names: ["hm", "h&m", "h m"], slug: "hm" },
  { names: ["adidas"], slug: "adidas" },
  { names: ["nike"], slug: "nike" },
  { names: ["decathlon"], slug: "decathlon" },
  { names: ["airbnb"], slug: "airbnb" },
  { names: ["invia"], slug: "invia" },
  { names: ["rohlik", "rohlik.sk"], slug: "rohlik" },
  { names: ["lenovo"], slug: "lenovo" },
  { names: ["panta rhei", "pantarhei"], slug: "panta-rhei" },
];

const CATEGORY_MAP: Record<string, string> = {
  "mobily": "Mobily",
  "telefóny": "Mobily",
  "telefony": "Mobily",
  "smartfóny": "Mobily",
  "smartfony": "Mobily",
  "notebooky": "Notebooky",
  "laptopy": "Notebooky",
  "laptops": "Notebooky",
  "televízory": "Televízory",
  "televizory": "Televízory",
  "tv": "Televízory",
  "chladničky": "Chladničky",
  "chladnicky": "Chladničky",
  "práčky": "Práčky",
  "pracky": "Práčky",
  "elektronika": "Elektronika",
  "tenisky": "Tenisky",
  "oblečenie": "Oblečenie",
  "oblecenie": "Oblečenie",
  "šaty": "Oblečenie",
  "saty": "Oblečenie",
  "topánky": "Topánky",
  "topanky": "Topánky",
  "obuv": "Topánky",
  "móda": "Móda",
  "moda": "Móda",
  "parfumy": "Parfumy",
  "kozmetika": "Kozmetika",
  "krása": "Kozmetika",
  "krasa": "Kozmetika",
  "šport": "Šport",
  "sport": "Šport",
  "fitness": "Šport",
  "bicykle": "Šport",
  "nábytok": "Bývanie",
  "nabytok": "Bývanie",
  "bývanie": "Bývanie",
  "byvanie": "Bývanie",
  "potraviny": "Potraviny",
  "jedlo": "Potraviny",
  "knihy": "Knihy",
  "hračky": "Deti",
  "hracky": "Deti",
  "deti": "Deti",
};

export type QueryType = "shop" | "category" | "product";

export function classifyQuery(query: string): QueryType {
  const lq = query.toLowerCase().trim();
  if (findShop(lq)) return "shop";
  if (CATEGORY_MAP[lq]) return "category";
  return "product";
}

export function findShop(query: string): { slug: string } | null {
  const lq = query.toLowerCase().trim();
  for (const shop of SHOP_LIST) {
    if (shop.names.includes(lq)) return { slug: shop.slug };
  }
  // Partial: query starts with a known shop name
  for (const shop of SHOP_LIST) {
    if (shop.names.some((n) => lq === n || lq.startsWith(n + " "))) {
      return { slug: shop.slug };
    }
  }
  return null;
}

export function getCategoryLabel(query: string): string | null {
  return CATEGORY_MAP[query.toLowerCase().trim()] ?? null;
}
