import type { HkFeedDef } from "./types";

const AFFIAL_AID = process.env.AFFIAL_ACCOUNT_ID ?? "6202d95ce406b";

// 20 overených Heureka XML feedov (SHOP/SHOPITEM formát, overené 2026-07-02)
// Google Shopping feedy vyradené (kosmetikomat.sk, blendea, li-go.cz, nechtovyraj.sk)
// tpmove.sk vyradený — universal.xml má SHOPITEM bez PRODUCTNAME (parser ho nevie spracovať)
// dadaboom, kojenecke-obleceni, belda, herbatica nemajú Affial program — affiliateUrl: null, tlačidlo vedie na URL produktu z feedu
const _FEEDS: HkFeedDef[] = [
  // bývanie
  {
    id: "e-matrac-sk",
    url: "https://www.e-matrac.sk/heureka/export/products.xml",
    domain: "e-matrac.sk",
    category: "byvanie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=7333ef8f",
  },
  {
    id: "fotoobrazyzplatna-sk",
    url: "https://www.fotoobrazyzplatna.cz/export/heureka.xml?lang=sk",
    domain: "fotoobrazyzplatna.sk",
    category: "byvanie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=86e29062",
  },
  // šport
  {
    id: "shox-sk",
    url: "https://www.shox.sk/wp-content/uploads/product-feeds/heureka_sk.xml",
    domain: "shox.sk",
    category: "sport",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=bf2d48e7",
  },
  {
    id: "shox-cz",
    url: "https://www.shox.cz/wp-content/uploads/product-feeds/heureka_cz.xml",
    domain: "shox.cz",
    category: "sport",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=796cb0f7",
  },
  {
    id: "belda-sk",
    url: "https://www.belda.sk/heureka/export/products.xml",
    domain: "belda.sk",
    category: "sport",
    affiliateUrl: null,
  },
  // zdravie
  {
    id: "superstrava-sk",
    url: "https://www.superstrava.sk/heureka/export/products.xml",
    domain: "superstrava.sk",
    category: "zdravie",
    affiliateUrl: "https://www.superstrava.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=02bd6c6c",
  },
  {
    id: "altevita-sk",
    url: "https://www.altevita.sk/heureka/export/products.xml",
    domain: "altevita.sk",
    category: "zdravie",
    affiliateUrl: "https://altevita.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=8bbcdb52",
  },
  {
    id: "herbatica-sk",
    url: "http://www.herbatica.sk/heureka/export/products.xml",
    domain: "herbatica.sk",
    category: "zdravie",
    affiliateUrl: null,
  },
  {
    id: "neurinu-cz",
    url: "https://www.neurinu.cz/wp-content/uploads/xml/heureka_1.xml",
    domain: "neurinu.cz",
    category: "zdravie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=1b6da38c",
  },
  // krása
  {
    id: "spaceylon-sk",
    url: "https://www.spaceylon.sk/fotky44397/xml/heureka_sk.xml",
    domain: "spaceylon.sk",
    category: "krasa",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=8dd268c9",
  },
  // móda
  {
    id: "enemiq-sk",
    url: "https://www.enemiq.sk/heureka/export/products.xml",
    domain: "enemiq.sk",
    category: "moda",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=0fd905ea",
  },
  {
    id: "enemiq-cz",
    url: "https://www.enemiq.cz/heureka/export/products.xml",
    domain: "enemiq.cz",
    category: "moda",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=584e8d61",
  },
  {
    id: "arno-obuv-sk",
    url: "https://www.arno-obuv.sk/feed/heureka",
    domain: "arno-obuv.sk",
    category: "moda",
    affiliateUrl: "https://www.arno-obuv.sk/?utm_medium=affiliate&utm_campaign=affial.com&utm_source=pap&a_aid=6202d95ce406b&a_bid=e6456574",
  },
  // deti
  {
    id: "dadaboom-sk",
    url: "https://www.dadaboom.sk/feed-heureka-tl7hkzvm56.xml",
    domain: "dadaboom.sk",
    category: "deti",
    affiliateUrl: null,
  },
  {
    id: "kojenecke-obleceni-eu",
    url: "https://www.kojenecke-obleceni.eu/export/heureka/472b02a8-25a0-4294-bec4-055a24411fd3",
    domain: "kojenecke-obleceni.eu",
    category: "deti",
    affiliateUrl: null,
  },
  // potraviny
  {
    id: "ajala-cz",
    url: "https://www.ajala.cz/heureka/export/products.xml",
    domain: "ajala.cz",
    category: "potraviny",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=6ff3c951",
  },
  // knihy
  {
    id: "togga-cz",
    url: "https://www.togga.cz/heureka/export/products.xml",
    domain: "togga.cz",
    category: "knihy",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=6c0959fa",
  },
  // iné
  {
    id: "happylu-cz",
    url: "https://www.happylu.cz/heureka/export/products.xml",
    domain: "happylu.cz",
    category: "ine",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=78943379",
  },
  {
    id: "auto123-sk",
    url: "https://auto123.sk/media/feeds/heureka.xml",
    domain: "auto123.sk",
    category: "ine",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=d7c0bd56",
  },
  {
    id: "vaporism-cz",
    url: "https://www.vaporism.cz/heureka/export/products.xml",
    domain: "vaporism.cz",
    category: "ine",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=40a4002b",
  },
];

export const HEUREKA_FEEDS: HkFeedDef[] = _FEEDS.map((f) => ({
  ...f,
  affiliateUrl: f.affiliateUrl ? f.affiliateUrl.replace("6202d95ce406b", AFFIAL_AID) : null,
}));
