import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import { resolveCategory } from "@/lib/shop-categories";
import type { CategoryId } from "@/lib/taxonomy";
import { compareShopsByPriority } from "@/lib/shop-priority";

/**
 * Kupón v jednotnom (dognet-like) tvare, aký očakáva CouponCard.
 * campaign.name / campaign_name nesie meno obchodu.
 */
export interface CategoryCoupon {
  id: string;
  code: string;
  title: string;
  name: string;
  description: string;
  type: number;
  affiliate_link: string;
  url: string;
  valid_to: string | null;
  campaign: { name: string };
  campaign_name: string;
  source: "dognet" | "ehub" | "affial";
}

/**
 * Kupóny pre kategóriu — obchod každého kupónu sa zaradí cez
 * resolveCategory() (explicitná mapa + sieťové labely). Nahrádza
 * keyword matching názvov a titulkov kupónov.
 */
export async function getCouponsByCategory(
  categoryId: CategoryId,
  limit = 12
): Promise<CategoryCoupon[]> {
  const [dognetRes, ehubRes, affialRes] = await Promise.allSettled([
    getCoupons(),
    getEhubCoupons(),
    getAffialCoupons(),
  ]);

  const unified: CategoryCoupon[] = [];

  if (dognetRes.status === "fulfilled") {
    for (const c of dognetRes.value) {
      const shopName = c.campaign?.name || c.campaign_name || "";
      unified.push({
        id: `dognet-${c.id}`,
        code: c.code || "",
        title: c.title || c.name || "",
        name: c.name || c.title || "",
        description: c.description || "",
        type: c.type || 1,
        affiliate_link: c.affiliate_link || c.url || "#",
        url: c.url || c.affiliate_link || "#",
        valid_to: c.valid_to || null,
        campaign: { name: shopName },
        campaign_name: shopName,
        source: "dognet",
      });
    }
  }

  if (ehubRes.status === "fulfilled") {
    for (const c of ehubRes.value) {
      unified.push({
        id: `ehub-${c.id}`,
        code: c.code,
        title: c.title || c.description || `Kupón pre ${c.campaign_name}`,
        name: c.title,
        description: c.description,
        type: 1,
        affiliate_link: c.affiliate_link,
        url: c.affiliate_link,
        valid_to: c.valid_to,
        campaign: { name: c.campaign_name },
        campaign_name: c.campaign_name,
        source: "ehub",
      });
    }
  }

  if (affialRes.status === "fulfilled") {
    for (const c of affialRes.value) {
      // campaign_name z Affial XML je doména ("zalando.sk")
      unified.push({
        id: c.id,
        code: c.code,
        title: c.title || (c.discount ? `${c.discount} zľava` : ""),
        name: c.title,
        description: c.description,
        type: 1,
        affiliate_link: c.affiliate_link,
        url: c.affiliate_link,
        valid_to: c.valid_to,
        campaign: { name: c.campaign_name },
        campaign_name: c.campaign_name,
        source: "affial",
      });
    }
  }

  // Filter podľa kategórie obchodu — meno slúži aj ako doména (Affial)
  const inCategory = unified.filter(
    c =>
      c.campaign_name &&
      resolveCategory({ name: c.campaign_name, domain: c.campaign_name }) === categoryId
  );

  // Dedup kódov naprieč sieťami (rovnaký kupón vo viacerých zdrojoch)
  const seenCodes = new Set<string>();
  const deduped = inCategory.filter(c => {
    if (!c.code) return true;
    const key = `${c.campaign_name.toLowerCase()}|${c.code.toUpperCase()}`;
    if (seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  });

  // .sk → .cz → ostatné, v rámci priority abecedne
  return deduped
    .sort((a, b) =>
      compareShopsByPriority({ name: a.campaign_name }, { name: b.campaign_name })
    )
    .slice(0, limit);
}
