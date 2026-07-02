import { getShopDomain } from "@/lib/shop-domains";

const skCollator = new Intl.Collator("sk", { sensitivity: "base" });

/**
 * Priorita obchodu podľa krajiny domény:
 * .sk = 1, .cz = 2, ostatné (.hu, .ro, .pl, .de, ...) = 3
 */
export function getShopPriority(domain?: string | null): number {
  const d = (domain || "").toLowerCase().trim().replace(/\/.*$/, "");
  if (d.endsWith(".sk")) return 1;
  if (d.endsWith(".cz")) return 2;
  return 3;
}

/** Doména pre výpočet priority — explicitná doména, inak mapa podľa mena, inak .sk (konvencia projektu). */
function priorityDomain(shop: { name: string; domain?: string | null }): string {
  return shop.domain?.trim() || getShopDomain(shop.name) || ".sk";
}

/** Komparátor: najprv .sk, potom .cz, potom ostatné; v rámci rovnakej priority abecedne (sk locale). */
export function compareShopsByPriority(
  a: { name: string; domain?: string | null },
  b: { name: string; domain?: string | null }
): number {
  const pa = getShopPriority(priorityDomain(a));
  const pb = getShopPriority(priorityDomain(b));
  if (pa !== pb) return pa - pb;
  return skCollator.compare(a.name, b.name);
}
