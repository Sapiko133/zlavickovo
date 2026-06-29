import { AFFIAL_SHOPS } from "../lib/affial-shops";

const AFFIAL_AID = "a_aid=6202d95ce406b";
const EHUB_AID   = "a_aid=85c7b80f";

function validateAffiliateLinks() {
  let ok = 0;
  let fail = 0;

  for (const shop of AFFIAL_SHOPS) {
    const url = shop.affiliateUrl;
    const isEhub   = url.includes("ehub.cz");
    const hasAid   = url.includes(AFFIAL_AID) || (isEhub && url.includes(EHUB_AID));
    const isValid  = url.startsWith("https://");

    if (!url || !isValid || !hasAid) {
      console.error(`FAIL [${shop.domain}]: ${url}`);
      fail++;
    } else {
      console.log(`OK   [${shop.domain}]: ${url.slice(0, 80)}…`);
      ok++;
    }
  }

  console.log(`\nVýsledok: ${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

validateAffiliateLinks();
