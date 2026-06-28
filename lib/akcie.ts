export type AkciaType = "doprava" | "vypredaj" | "welcome" | "cashback" | "cashback" | "gift" | "event";

export interface Akcia {
  id: string;
  shopName: string;
  domain: string;
  title: string;
  description: string;
  type: AkciaType;
  badge?: string;          // e.g. "ZADARMO", "-30%", "5% cashback"
  affiliateUrl: string;
  validTo?: string;        // ISO date or null = ongoing
  source: "static" | "dognet" | "ehub";
}

// Long-running promotions from well-known SK/CZ shops
// Conditions verified at time of writing — always link to shop for current terms
export const STATIC_AKCIE: Akcia[] = [
  {
    id: "alza-doprava",
    shopName: "Alza.sk",
    domain: "alza.sk",
    title: "Doprava zadarmo nad 59 €",
    description: "Pri objednávke nad 59 € máte dopravu zadarmo kuriérom alebo na AlzaBox.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.alza.sk",
    source: "static",
  },
  {
    id: "zalando-doprava",
    shopName: "Zalando.sk",
    domain: "zalando.sk",
    title: "Doprava a vrátenie zadarmo",
    description: "Zalando ponúka dopravu zadarmo na každú objednávku a bezplatné vrátenie do 100 dní.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.zalando.sk",
    source: "static",
  },
  {
    id: "mall-doprava",
    shopName: "Mall.sk",
    domain: "mall.sk",
    title: "Doprava zadarmo nad 39 €",
    description: "Na Mall.sk máte pri nákupe nad 39 € dopravu zadarmo.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.mall.sk",
    source: "static",
  },
  {
    id: "notino-doprava",
    shopName: "Notino.sk",
    domain: "notino.sk",
    title: "Doprava zadarmo nad 40 €",
    description: "Nakúpte nad 40 € a doprava je zadarmo. Každý mesiac nové vzorky k objednávke.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.notino.sk",
    source: "static",
  },
  {
    id: "drmax-doprava",
    shopName: "Dr.Max.sk",
    domain: "drmax.sk",
    title: "Doprava zadarmo nad 29,90 €",
    description: "Objednajte lieky, vitamíny a kozmetiku s dopravou zadarmo pri nákupe nad 29,90 €.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.drmax.sk",
    source: "static",
  },
  {
    id: "temu-doprava",
    shopName: "Temu.com",
    domain: "temu.com",
    title: "Doprava zadarmo na každú objednávku",
    description: "Temu ponúka dopravu zadarmo bez minimálnej sumy objednávky.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.temu.com",
    source: "static",
  },
  {
    id: "shein-doprava",
    shopName: "Shein.com",
    domain: "shein.com",
    title: "Doprava zadarmo nad 29 €",
    description: "SHEIN — módne oblečenie s dopravou zadarmo nad 29 €.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.shein.com",
    source: "static",
  },
  {
    id: "zoot-doprava",
    shopName: "ZOOT.sk",
    domain: "zoot.sk",
    title: "Doprava a vrátenie zadarmo",
    description: "ZOOT — doprava zadarmo a vrátenie tovaru do 365 dní bez udania dôvodu.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.zoot.sk",
    source: "static",
  },
  {
    id: "datart-vypredaj",
    shopName: "Datart.sk",
    domain: "datart.sk",
    title: "Výpredaj elektroniky každý týždeň",
    description: "Datart každý týždeň pridáva nové výpredajové ceny na spotrebnú elektroniku.",
    type: "vypredaj",
    badge: "VÝPREDAJ",
    affiliateUrl: "https://www.datart.sk/vypredaj",
    source: "static",
  },
  {
    id: "lidl-tydenne",
    shopName: "Lidl.sk",
    domain: "lidl.sk",
    title: "Týždenné akcie od pondelka",
    description: "Lidl Shop online — každý pondelok nové cenové akcie na potraviny aj nepotravinársky tovar.",
    type: "event",
    badge: "TÝŽDENNÉ",
    affiliateUrl: "https://www.lidl.sk",
    source: "static",
  },
  {
    id: "okay-vypredaj",
    shopName: "Okay.sk",
    domain: "okay.sk",
    title: "Výpredaj spotrebičov a TV",
    description: "OKAY — pravidelný výpredaj televízorov, práčok, chladničiek a domácich spotrebičov.",
    type: "vypredaj",
    badge: "VÝPREDAJ",
    affiliateUrl: "https://www.okay.sk/vypredaj",
    source: "static",
  },
  {
    id: "alza-alza-plus",
    shopName: "Alza.sk",
    domain: "alza.sk",
    title: "AlzaPlus+ — doprava zadarmo vždy",
    description: "S AlzaPlus+ predplatným máte dopravu zadarmo na každú objednávku a ďalšie výhody.",
    type: "welcome",
    badge: "PREDPLATNÉ",
    affiliateUrl: "https://www.alza.sk/alza-plus",
    source: "static",
  },
  {
    id: "nike-akcie",
    shopName: "Nike.sk",
    domain: "nike.com",
    title: "Výpredaj Nike — až -40%",
    description: "Nike výpredaj — topánky, oblečenie a doplnky za výhodné ceny.",
    type: "vypredaj",
    badge: "AŽ -40%",
    affiliateUrl: "https://www.nike.com/sk",
    source: "static",
  },
  {
    id: "aboutyou-welcome",
    shopName: "AboutYou.sk",
    domain: "aboutyou.sk",
    title: "-10% na prvú objednávku",
    description: "Zaregistrujte sa na AboutYou a získajte 10% zľavu na prvý nákup.",
    type: "welcome",
    badge: "-10%",
    affiliateUrl: "https://www.aboutyou.sk",
    source: "static",
  },
  {
    id: "notino-gift",
    shopName: "Notino.sk",
    domain: "notino.sk",
    title: "Darček k nákupu od 30 €",
    description: "Notino pridáva vzorky a darčeky kozmetiky k objednávkam nad 30 €.",
    type: "gift",
    badge: "DARČEK",
    affiliateUrl: "https://www.notino.sk",
    source: "static",
  },
  {
    id: "eobuv-doprava",
    shopName: "eobuv.sk",
    domain: "eobuv.sk",
    title: "Doprava zadarmo + vrátenie 365 dní",
    description: "eobuv.sk ponúka dopravu zadarmo a vrátenie topánok do 365 dní.",
    type: "doprava",
    badge: "ZADARMO",
    affiliateUrl: "https://www.eobuv.sk",
    source: "static",
  },
];

// Maps Dognet coupon type 3 (výpredaj) / type 1 (zľava) to Akcia
export function dognetCouponToAkcia(c: any): Akcia {
  const shopName = c.campaign?.name ?? c.name ?? "Obchod";
  const domain = (c.campaign?.website_url ?? "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "") || "";
  const pct = (c.title || c.name || "").match(/(\d+)\s*%/);
  return {
    id: `dognet-${c.id}`,
    shopName,
    domain,
    title: c.title || c.name || `Akcia v ${shopName}`,
    description: c.description || "",
    type: c.type === 3 ? "vypredaj" : "vypredaj",
    badge: pct ? `-${pct[1]}%` : "AKCIA",
    affiliateUrl: c.affiliate_link || c.url || `https://${domain}`,
    validTo: c.valid_to ?? null,
    source: "dognet",
  };
}
