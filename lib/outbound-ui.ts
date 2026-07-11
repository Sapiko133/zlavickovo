import type { OfferOutboundKind } from "./heureka/affiliate";
import type { ClickType } from "./click-types";

/**
 * Mapovanie typu outbound ponuky (getOfferOutbound) na tracking ClickType —
 * jeden zdroj pre search karty, shop produkty aj poklesy cien. Klient-safe
 * (žiadne env ani server importy).
 */
export function outboundClickType(kind: OfferOutboundKind): ClickType {
  return kind === "heureka_fallback" ? "heureka_fallback" : "product_outbound";
}
