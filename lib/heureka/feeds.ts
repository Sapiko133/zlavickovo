import type { HkFeedDef } from "./types";

const AFFIAL_AID = process.env.AFFIAL_ACCOUNT_ID ?? "";

// Pilotné 3 Heureka XML feedy — affiliate URL z existujúceho Affial nastavenia
const _FEEDS: HkFeedDef[] = [
  {
    id: "kosmetikomat-sk",
    url: "https://www.kosmetikomat.sk/google.xml?hash=M2iNmNTwx981bVRSOfCjF5uo",
    domain: "kosmetikomat.sk",
    category: "krasa",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=7f1e0945",
  },
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
