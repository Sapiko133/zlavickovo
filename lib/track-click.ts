/**
 * Klientský helper na odoslanie outbound-klik eventu na /api/track-click.
 *
 * Používa navigator.sendBeacon (prežije navigáciu na affiliate link, neblokuje),
 * s fetch keepalive fallbackom. Nikdy nevyhadzuje — tracking nesmie pokaziť klik.
 * Zdroj (source) sa dopočíta z location.pathname, ak ho volajúci neuvedie.
 */
import type { ClickEventInput } from "@/lib/click-types";

/** Odvodenie source zo stránky, na ktorej klik vznikol. */
function deriveSource(): string {
  if (typeof window === "undefined") return "other";
  const p = window.location.pathname;
  if (p === "/") return "homepage";
  if (p === "/hladat") return "search";
  if (p.startsWith("/produkt/")) return "product_page";
  if (p === "/kupony") return "coupons_page";
  if (p.startsWith("/kupony/")) return "shop_page";
  if (p === "/akcie") return "akcie_page";
  if (p.startsWith("/kategoria")) return "category_page";
  return "other";
}

export function trackClick(ev: ClickEventInput): void {
  try {
    const payload: ClickEventInput = { ...ev, source: ev.source || deriveSource() };
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track-click", blob);
      return;
    }
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ticho
  }
}
