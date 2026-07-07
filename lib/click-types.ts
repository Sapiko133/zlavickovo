/**
 * Zdieľané typy pre tracking outbound/affiliate klikov.
 * Žiadne server ani client importy — bezpečné pre obe strany.
 */

export type ClickType =
  | "product_outbound"   // Produkt → obchod (Kúpiť / Otvoriť v obchode)
  | "coupon_reveal"      // Klik na „Zobraziť kód"
  | "coupon_outbound"    // Kupón bez kódu → „Prejsť na ponuku"
  | "action_outbound"    // Akcia → „Prejsť na ponuku / Využiť"
  | "shop_outbound"      // „Prejsť do obchodu"
  | "heureka_fallback";  // „Zobraziť ponuky na Heureke"

export const CLICK_TYPES: ClickType[] = [
  "product_outbound",
  "coupon_reveal",
  "coupon_outbound",
  "action_outbound",
  "shop_outbound",
  "heureka_fallback",
];

/** Payload, ktorý posiela klient na /api/track-click (source sa dopočíta z pathname). */
export interface ClickEventInput {
  type: ClickType;
  source?: string;
  shopSlug?: string | null;
  productSlug?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  /** Cieľová URL (affiliate/obchod) — server z nej odvodí destinationDomain. */
  destination?: string | null;
  destinationDomain?: string | null;
  query?: string | null;
}
