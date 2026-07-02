import type { HkFeedDef } from "./types";

const AFFIAL_AID = process.env.AFFIAL_ACCOUNT_ID ?? "6202d95ce406b";

// 52 overených Heureka XML feedov (SHOP/SHOPITEM formát, PRODUCTNAME + PRICE_VAT + URL, overené 2026-07-02)
// Bezpečnostné čistenie 2026-07-02: vyradené bottle-store.sk (alkohol) a vaporism.cz (vape/nikotín)
// Google Shopping feedy vyradené (kosmetikomat.sk, blendea, nechtovyraj.sk)
// li-go.cz má popri Google feede aj validný /heureka/export/products.xml — pridaný
// tpmove.sk vyradený — universal.xml má SHOPITEM bez PRODUCTNAME (parser ho nevie spracovať)
// Feedy bez Affial programu majú affiliateUrl: null — tlačidlo vedie na URL produktu z feedu
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
  // vaporism.cz vyradený 2026-07-02 — e-cigarety a nikotínové e-liquidy (bezpečnostné čistenie)

  // ===== Rozšírenie na ~50 feedov (overené 2026-07-02) =====
  // bývanie / domácnosť
  {
    id: "li-go-cz",
    url: "https://www.li-go.cz/heureka/export/products.xml",
    domain: "li-go.cz",
    category: "byvanie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=d344a869",
  },
  {
    id: "artofhome-cz",
    url: "https://www.artofhome.cz/heureka/export/products.xml",
    domain: "artofhome.cz",
    category: "byvanie",
    affiliateUrl: "https://login.affial.com/scripts/8m338kc?a_aid=6202d95ce406b&a_bid=9612d676",
  },
  {
    id: "nanospace-cz",
    url: "https://www.nanospace.cz/heureka/export/products.xml",
    domain: "nanospace.cz",
    category: "byvanie",
    affiliateUrl: null,
  },
  {
    id: "kulina-sk",
    url: "https://www.kulina.sk/heureka/export/products.xml",
    domain: "kulina.sk",
    category: "byvanie",
    affiliateUrl: null,
  },
  {
    id: "kulina-cz",
    url: "https://www.kulina.cz/heureka/export/products.xml",
    domain: "kulina.cz",
    category: "byvanie",
    affiliateUrl: null,
  },
  // bottle-store.sk vyradený 2026-07-02 — alkohol e-shop (bezpečnostné čistenie)
  {
    id: "mafecandles-cz",
    url: "https://www.mafecandles.cz/heureka/export/products.xml",
    domain: "mafecandles.cz",
    category: "byvanie",
    affiliateUrl: null,
  },
  // zdravie
  {
    id: "zelenazeme-cz",
    url: "https://www.zelenazeme.cz/heureka/export/products.xml",
    domain: "zelenazeme.cz",
    category: "zdravie",
    affiliateUrl: null,
    // bezpečnostné čistenie: CBD kvety/herba a vaporizéry (vrátane príslušenstva) sa neimportujú
    exclude: ["cbd flower", "cbd kvet", "cbd herba", "vaporiz", "cartridge"],
  },
  {
    id: "matchatea-bio",
    url: "https://www.matchatea.bio/heureka/export/products.xml",
    domain: "matchatea.bio",
    category: "zdravie",
    affiliateUrl: null,
  },
  {
    id: "puravidashop-cz",
    url: "https://www.puravidashop.cz/heureka/export/products.xml",
    domain: "puravidashop.cz",
    category: "zdravie",
    affiliateUrl: null,
  },
  // krása
  {
    id: "angrybeards-sk",
    url: "https://www.angrybeards.sk/heureka/export/products.xml",
    domain: "angrybeards.sk",
    category: "krasa",
    affiliateUrl: null,
  },
  {
    id: "angrybeards-cz",
    url: "https://www.angrybeards.cz/heureka/export/products.xml",
    domain: "angrybeards.cz",
    category: "krasa",
    affiliateUrl: null,
  },
  {
    id: "creammy-cz",
    url: "https://www.creammy.cz/heureka/export/products.xml",
    domain: "creammy.cz",
    category: "krasa",
    affiliateUrl: null,
  },
  // šport
  {
    id: "vifsports-cz",
    url: "https://www.vifsports.cz/heureka/export/products.xml",
    domain: "vifsports.cz",
    category: "sport",
    affiliateUrl: null,
  },
  // deti
  {
    id: "benlemi-sk",
    url: "https://www.benlemi.sk/heureka/export/products.xml",
    domain: "benlemi.sk",
    category: "deti",
    affiliateUrl: null,
  },
  {
    id: "slnieckovo-sk",
    url: "https://www.slnieckovo.sk/heureka/export/products.xml",
    domain: "slnieckovo.sk",
    category: "deti",
    affiliateUrl: null,
  },
  {
    id: "elisdesign-cz",
    url: "https://www.elisdesign.cz/heureka/export/products.xml",
    domain: "elisdesign.cz",
    category: "deti",
    affiliateUrl: null,
  },
  // hobby
  {
    id: "aeromodel-sk",
    url: "https://www.aeromodel.sk/heureka/export/products.xml",
    domain: "aeromodel.sk",
    category: "hobby",
    affiliateUrl: null,
  },
  {
    id: "mincmistr-cz",
    url: "https://www.mincmistr.cz/heureka/export/products.xml",
    domain: "mincmistr.cz",
    category: "hobby",
    affiliateUrl: null,
  },
  // záhrada
  {
    id: "mojerosty-sk",
    url: "https://www.mojerosty.sk/heureka/export/products.xml",
    domain: "mojerosty.sk",
    category: "zahrada",
    affiliateUrl: null,
  },
  // móda
  {
    id: "daponti-sk",
    url: "https://www.daponti.sk/heureka/export/products.xml",
    domain: "daponti.sk",
    category: "moda",
    affiliateUrl: null,
  },
  {
    id: "miabella-cz",
    url: "https://www.miabella.cz/heureka/export/products.xml",
    domain: "miabella.cz",
    category: "moda",
    affiliateUrl: null,
  },
  {
    id: "tiami-cz",
    url: "https://www.tiami.cz/heureka/export/products.xml",
    domain: "tiami.cz",
    category: "moda",
    affiliateUrl: null,
  },
  {
    id: "lobey-cz",
    url: "https://www.lobey.cz/heureka/export/products.xml",
    domain: "lobey.cz",
    category: "moda",
    affiliateUrl: null,
  },
  {
    id: "salted-cz",
    url: "https://www.salted.cz/heureka/export/products.xml",
    domain: "salted.cz",
    category: "moda",
    affiliateUrl: null,
  },
  // potraviny
  {
    id: "kofi-sk",
    url: "https://www.kofi.sk/heureka/export/products.xml",
    domain: "kofi.sk",
    category: "potraviny",
    affiliateUrl: null,
  },
  {
    id: "coffeesheep-sk",
    url: "https://www.coffeesheep.sk/heureka/export/products.xml",
    domain: "coffeesheep.sk",
    category: "potraviny",
    affiliateUrl: null,
  },
  {
    id: "cokoladovnatroubelice-cz",
    url: "https://www.cokoladovnatroubelice.cz/heureka/export/products.xml",
    domain: "cokoladovnatroubelice.cz",
    category: "potraviny",
    affiliateUrl: null,
  },
  // iné
  {
    id: "fabulo-sk",
    url: "https://www.fabulo.sk/heureka/export/products.xml",
    domain: "fabulo.sk",
    category: "ine",
    affiliateUrl: null,
  },
  {
    id: "darbox-sk",
    url: "https://www.darbox.sk/heureka/export/products.xml",
    domain: "darbox.sk",
    category: "ine",
    affiliateUrl: null,
  },
  {
    id: "heliumking-sk",
    url: "https://www.heliumking.sk/heureka/export/products.xml",
    domain: "heliumking.sk",
    category: "ine",
    affiliateUrl: null,
  },
  {
    id: "plzr-sk",
    url: "https://www.plzr.sk/heureka/export/products.xml",
    domain: "plzr.sk",
    category: "ine",
    affiliateUrl: null,
  },
  {
    id: "keeostore-cz",
    url: "https://www.keeostore.cz/heureka/export/products.xml",
    domain: "keeostore.cz",
    category: "ine",
    affiliateUrl: null,
  },
  {
    id: "trivjednom-cz",
    url: "https://www.3v1trivjednom.cz/heureka/export/products.xml",
    domain: "3v1trivjednom.cz",
    category: "ine",
    affiliateUrl: null,
  },
];

export const HEUREKA_FEEDS: HkFeedDef[] = _FEEDS.map((f) => ({
  ...f,
  affiliateUrl: f.affiliateUrl ? f.affiliateUrl.replace("6202d95ce406b", AFFIAL_AID) : null,
}));
