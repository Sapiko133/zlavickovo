/**
 * Testy presného shop matchingu (createShopMatcher).
 *
 * Regresia na bug: voľný substring match posielal Mall na affiliate link
 * BabyMall.cz ("babymallcz" obsahuje "mall"). Match musí byť presný podľa
 * normalizovaného názvu/slug-u/domény; viacznačkové názvy feedov
 * ("Alza.cz + Alza.sk") sa porovnávajú po častiach, nie substringom.
 *
 * Spustenie: npx tsx scripts/test-shop-match.ts
 */
import assert from "node:assert/strict";
import { createShopMatcher } from "../lib/shop-match.ts";

function check(shop: string, name: string | null, domain: string | null, expected: boolean) {
  const matches = createShopMatcher(shop);
  assert.equal(
    matches(name, domain),
    expected,
    `${shop} vs name="${name}" domain="${domain}" → očakávané ${expected}`
  );
}

// ── cudzie obchody NESMÚ matchovať (bug: substring) ──
check("mall", "BabyMall.cz", "https://www.babymall.cz/", false);
check("mall", "Manmall.cz", "https://manmall.cz/", false);
check("mall", "Beautydepot.sk", "https://beautydepot.sk/", false);
check("tesco", "Tescoma", "https://www.tescoma.sk/", false);
check("zalando", "Zalando-lounge.cz", "https://www.zalando-lounge.cz/", false);
check("protein", "Vivolifeprotein.cz", "https://www.vivolifeprotein.cz/", false);
check("koberce", "Hezkekoberce.cz", "https://www.hezkekoberce.cz/", false);

// ── vlastný obchod MUSÍ matchovať ──
check("mall", "Mall.sk", "https://www.mall.sk/", true);
check("mall", "MALL.SK", null, true);
check("mall", null, "mall.sk", true);
check("alza", "Alza.sk", "https://www.alza.sk/", true);
check("alza", "Alza", null, true);
check("notino", "Notino.sk", null, true);
check("beautydepot", "Beautydepot.sk", "https://beautydepot.sk/", true);
check("dr-max", "Dr.Max.sk", "https://www.drmax.sk/", true);
check("about-you", "ABOUT YOU SK", null, true);

// ── viacznačkové/kombinované názvy feedov — match po častiach ──
check("alza", "Alza.cz + Alza.sk", null, true);
check("vivantis", "Vivantis.sk (parfémy)", null, true);
check("4home", "4home.sk - všetko pre domácnosť", null, true);
check("answear", "Answear.sk, Answear.cz", null, true);
// časti nesmú matchovať cudzí obchod
check("mall", "BabyMall.cz + BabyMall.sk", null, false);

// ── doména: presná zhoda základu, nie substring ──
check("mall", null, "https://www.babymall.cz/", false);
check("mall", null, "https://www.mall.cz/", true);

console.log("Shop match tests passed.");
