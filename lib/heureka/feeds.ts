import type { HkFeedDef } from "./types";

const AFFIAL_AID = process.env.AFFIAL_ACCOUNT_ID ?? "6202d95ce406b";

// Pilotné 2 Heureka XML feedy (kosmetikomat vyradený — google.xml nie je Heureka formát)
const _FEEDS: HkFeedDef[] = [
  {
    id: "e-matrac-sk",
    url: "https://www.e-matrac.sk/heureka/export/products.xml",
    domain: "e-matrac.sk",
    category: "byvanie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=7333ef8f",
  },
  {
    id: "shox-sk",
    url: "https://www.shox.sk/wp-content/uploads/product-feeds/heureka_sk.xml",
    domain: "shox.sk",
    category: "sport",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=bf2d48e7",
  },
];

export const HEUREKA_FEEDS: HkFeedDef[] = _FEEDS.map((f) => ({
  ...f,
  affiliateUrl: f.affiliateUrl.replace("6202d95ce406b", AFFIAL_AID),
}));
