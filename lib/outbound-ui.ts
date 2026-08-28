import type { OfferOutboundKind } from "./offers/outbound";
import type { ClickType } from "./click-types";

/**
 * Mapovanie typu outbound ponuky (resolveOfferOutbound) na tracking ClickType.
 * Klient-safe (žiadne env ani server importy).
 */
export function outboundClickType(_kind: OfferOutboundKind): ClickType {
  return "shop_outbound";
}
