import { redis } from "@/lib/redis";

const GENERIC: Record<string, string> = {
  alza: "Alza.sk je najväčší slovenský e-shop s elektronikou, spotrebičmi, mobilmi a tisíckami ďalších produktov. Ponúka rýchle doručenie, vernostný program Alza Body a pravidelné akcie s veľkými zľavami. Ide-álne miesto pre nákup elektroniky za konkurenčné ceny.",
  shein: "Shein je globálna módna platforma s obrovským výberom oblečenia, obuvi a doplnkov za ultra-nízke ceny. Ponúka nové kolekcie každý deň a exkluzívne zľavy pre nových zákazníkov aj verných nakupujúcich.",
  zalando: "Zalando je najväčší európsky módny e-shop s tisíckami značiek od Adidas, Nike až po H&M a Zara. Bezplatné vrátenie tovaru, rýchle doručenie a rozsiahla SALE sekcia robia z Zalando ideálne miesto pre módu.",
  mall: "Mall.sk je komplexný e-shop s elektronikou, domácimi spotrebičmi, nábytkom a športovým vybavením. Ponúka prémiový vernostný program a pravidelnú sekciu s výpredajmi.",
  notino: "Notino je najväčšia online parfuméria v Európe s tisíckami parfumov, kozmetiky a prípravkov na starostlivosť o pleť a vlasy. Nájdeš tu prémiové značky za výhodné ceny.",
  sportisimo: "Sportisimo je vedúci predajca športového vybavenia na Slovensku. Ponúka oblečenie, obuv a vybavenie pre všetky športy od Nike, Adidas, Puma a ďalších svetových značiek.",
  ikea: "IKEA je synonymom pre škandinávsky dizajn a dostupný nábytok. Ponúka kompletné riešenia pre každú miestnosť, od obývačky po kúpeľňu, za ceny dostupné pre každého.",
  dedoles: "Dedoles je slovenská módna značka known pre originálne potlačené ponožky, pyžamá a oblečenie. Každý produkt je originálny kúsok, ideálny ako darček alebo na každodenné nosenie.",
  martinus: "Martinus je najobľúbenejší slovenský kníhkupec s obrovským výberom kníh, e-kníh a audiokníh. Ponúka slovenské aj české tituly, novinky aj klasiku za výhodné ceny.",
  "about-you": "About You je personalizovaná módna platforma s výberom prispôsobeným tvojmu vkusu. Predáva oblečenie, obuv a doplnky od stoviek európskych a svetových značiek.",
  "dr-max": "Dr. Max je najväčšia lekárenská sieť na Slovensku. Online lekáreň ponúka lieky bez predpisu, vitamíny, doplnky stravy a kozmetiku s rýchlym doručením.",
  gymbeam: "GymBeam je slovenská fitness e-commerce úspešnica s vlastnou výrobou proteínov, vitamínov a ďalších doplnkov stravy. Výborný pomer ceny a kvality pre každého, kto dbá o zdravý životný štýl.",
};

function genericDesc(shopName: string): string {
  const key = shopName.toLowerCase().replace(/\s+/g, "-");
  if (GENERIC[key]) return GENERIC[key];
  return `${shopName} je populárny online obchod ponúkajúci širokú škálu produktov pre slovenských zákazníkov. Pravidelne vydáva zľavové kódy a akcie, vďaka ktorým môžete ušetriť na svojich nákupoch. Nájdite aktuálne kupóny práve tu na Zlavickovo.sk.`;
}

export async function getShopDescription(shopName: string, slug: string): Promise<string> {
  const cacheKey = `shop_desc:${slug}`;

  // 1. Try Redis cache
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) return cached;
  } catch {}

  // 2. Try Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Napíš krátky popis obchodu ${shopName} v 150-200 slovách po slovensky. Zahrň: čo predávajú, prečo tam nakupovať, aké zľavy ponúkajú a tipy pre zákazníkov. Píš priamo, bez nadpisov, len súvislý text.`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text?.trim();
        if (text && text.length > 50) {
          // Cache for 7 days
          try { await redis.set(cacheKey, text, { ex: 86400 * 7 }); } catch {}
          return text;
        }
      }
    } catch {}
  }

  // 3. Fallback
  const desc = genericDesc(shopName);
  try { await redis.set(cacheKey, desc, { ex: 86400 * 7 }); } catch {}
  return desc;
}
