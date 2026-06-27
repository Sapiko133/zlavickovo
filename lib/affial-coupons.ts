export interface AffialCoupon {
  shop: string;
  domain: string;
  code: string;
  discount: string;
  expires: string;
}

export const AFFIAL_COUPONS: AffialCoupon[] = [
  { shop: "Vimax.sk", domain: "vimax.sk", code: "ZLAVA10", discount: "10%", expires: "neomedzená" },
  { shop: "Blendea.sk", domain: "blendea.sk", code: "ZLAVA10", discount: "10%", expires: "neomedzená" },
  { shop: "Blendea.cz", domain: "blendea.cz", code: "SLEVA10", discount: "10%", expires: "neomedzená" },
  { shop: "Namaximum.sk", domain: "namaximum.sk", code: "5NM2026", discount: "5%", expires: "31.12.2026" },
  { shop: "Namaximum.sk", domain: "namaximum.sk", code: "AFFIAL6", discount: "6%", expires: "neomedzená" },
  { shop: "Superstrava.sk", domain: "superstrava.sk", code: "Super10", discount: "10%", expires: "neomedzená" },
  { shop: "Remoska.sk", domain: "remoska.sk", code: "REMOSKAAFFIAL", discount: "10%", expires: "neomedzená" },
  { shop: "Mebik.sk", domain: "mebik.sk", code: "EM5GBU2U", discount: "5%", expires: "31.12.2026" },
  { shop: "Fotoobrazyzplatna.sk", domain: "fotoobrazyzplatna.sk", code: "AFFIAL10", discount: "10%", expires: "7.12.2026" },
  { shop: "E-matrac.sk", domain: "e-matrac.sk", code: "ematrac5", discount: "5%", expires: "neomedzená" },
  { shop: "TPmove.sk", domain: "tpmove.sk", code: "affial5", discount: "5€", expires: "neomedzená" },
  { shop: "TPmove.sk", domain: "tpmove.sk", code: "affial10", discount: "10%", expires: "neomedzená" },
  { shop: "Lovemosh.eu", domain: "lovemosh.eu", code: "vbn5qa3xgn", discount: "10%", expires: "neomedzená" },
  { shop: "Togga.cz", domain: "togga.cz", code: "TOGGAPARTNER", discount: "100 Kč", expires: "neomedzená" },
  { shop: "Matchaday.sk", domain: "matchaday.sk", code: "matcha5", discount: "5%", expires: "neomedzená" },
  { shop: "Hairburst.sk", domain: "hairburst.sk", code: "AFFIAL10", discount: "10%", expires: "neomedzená" },
  { shop: "Neohack.sk", domain: "neohack.sk", code: "NEO5HACK", discount: "5%", expires: "neomedzená" },
  { shop: "Kosmetikomat.sk", domain: "kosmetikomat.sk", code: "AFFIAL10", discount: "10%", expires: "neomedzená" },
  { shop: "Altevita.sk", domain: "altevita.sk", code: "ALTEVITA10", discount: "10%", expires: "neomedzená" },
  { shop: "Spaceylon.sk", domain: "spaceylon.sk", code: "AFFIAL10", discount: "10%", expires: "neomedzená" },
];

export function getAffialCouponsByDomain(domain: string): AffialCoupon[] {
  return AFFIAL_COUPONS.filter((c) => c.domain === domain);
}

export function searchAffialCoupons(query: string): AffialCoupon[] {
  const lq = query.toLowerCase();
  return AFFIAL_COUPONS.filter(
    (c) =>
      c.shop.toLowerCase().includes(lq) ||
      c.domain.toLowerCase().includes(lq) ||
      c.discount.toLowerCase().includes(lq)
  );
}
