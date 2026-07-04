import { getCoupons as getDognetCoupons } from "@/lib/dognet";
import { getEhubCoupons } from "@/lib/ehub";
import { getAffialCoupons } from "@/lib/affial";
import { getCjCoupons } from "@/lib/cj";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { getAllKnownShops } from "@/lib/all-shops";
import { normalizeShopSlug } from "@/lib/slug";
import { feedManager } from "@/lib/feeds/FeedManager";
import { searchHkProducts, toProductSlug } from "@/lib/heureka/query";
import { compareShopsByPriority } from "@/lib/shop-priority";

export const dynamic = "force-dynamic";

interface ShopEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

interface ProductEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
  price?: string;
  url?: string;
}

// Jediný zdroj pravdy — lib/all-shops.ts (getAllKnownShops)
async function getAllShops(): Promise<ShopEntry[]> {
  const shops = await getAllKnownShops();
  return shops.map(s => ({ name: s.name, slug: s.slug, category: s.category, domain: s.domain }));
}

const skCollator = new Intl.Collator("sk", { sensitivity: "base" });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const q = searchParams.get("q") || "";

  // ── Unified mode: products + shops + coupons ─────────────────
  if (mode === "unified") {
    if (q.trim().length < 2) {
      return Response.json({ products: [], shops: [], coupons: [] });
    }
    const lq = q.trim().toLowerCase();
    // Normalizovaný dopyt pre slug matching — "SHEIN" → "shein", "shein.sk"/"shein.com" → "shein"
    const sq = normalizeShopSlug(q);

    const [hkResult, shopsResult, dognetCouponsResult, ehubCouponsResult, affialCouponsResult, cjCouponsResult] =
      await Promise.allSettled([
        searchHkProducts(q, 20),
        getAllShops(),
        getDognetCoupons(),
        getEhubCoupons(),
        getAffialCoupons(),
        getCjCoupons(),
      ]);

    // Produkty — hk_products, abecedne, max 5
    const products =
      hkResult.status === "fulfilled"
        ? hkResult.value
            .map(p => {
              const slug = toProductSlug(p.name, p.id);
              return { slug, name: p.name, url: `/produkt/${slug}` };
            })
            .sort((a, b) => skCollator.compare(a.name, b.name))
            .slice(0, 5)
        : [];

    // Obchody — shop cache, max 5. Radenie: exact match → prefix → substring,
    // v rámci rovnakej zhody .sk → .cz → ostatné ("mall" → Mall pred BabyMall)
    const matchRank = (s: ShopEntry): number => {
      const name = s.name.toLowerCase();
      if (name === lq || (sq.length > 0 && s.slug === sq)) return 0;
      if (name.startsWith(lq) || (sq.length > 0 && s.slug.startsWith(sq))) return 1;
      return 2;
    };
    const shops =
      shopsResult.status === "fulfilled"
        ? shopsResult.value
            .filter(s =>
              s.name.toLowerCase().includes(lq) ||
              s.domain.toLowerCase().includes(lq) ||
              (sq.length > 0 && s.slug.includes(sq))
            )
            .sort((a, b) => matchRank(a) - matchRank(b) || compareShopsByPriority(a, b))
            .slice(0, 5)
            .map(s => ({ name: s.name, slug: s.slug, domain: s.domain }))
        : [];

    // Kupóny — rovnaké zdroje ako shop stránka (Dognet + eHub + Affial XML +
    // CJ + statické Affial kupóny), max 5
    interface CouponEntry { title: string; shopName: string; shopSlug: string }
    const coupons: CouponEntry[] = [];
    const seenCoupons = new Set<string>();

    const pushCoupon = (title: string, shopName: string) => {
      if (!title || !shopName) return;
      if (!title.toLowerCase().includes(lq) && !shopName.toLowerCase().includes(lq)) return;
      const key = `${title.toLowerCase()}|${shopName.toLowerCase()}`;
      if (seenCoupons.has(key)) return;
      seenCoupons.add(key);
      coupons.push({ title, shopName, shopSlug: normalizeShopSlug(shopName) });
    };

    if (dognetCouponsResult.status === "fulfilled") {
      for (const c of dognetCouponsResult.value) {
        pushCoupon(c.title || c.name || "", c.campaign?.name || "");
      }
    }
    if (ehubCouponsResult.status === "fulfilled") {
      for (const c of ehubCouponsResult.value) {
        pushCoupon(c.title || c.description || "", c.campaign_name || "");
      }
    }
    if (affialCouponsResult.status === "fulfilled") {
      for (const c of affialCouponsResult.value) {
        pushCoupon(c.title || c.description || "", c.campaign_name || "");
      }
    }
    if (cjCouponsResult.status === "fulfilled") {
      for (const c of cjCouponsResult.value) {
        pushCoupon(c.description || "", c.advertiserName || "");
      }
    }
    for (const c of AFFIAL_COUPONS) {
      pushCoupon(`${c.discount} zľava`, c.shop);
    }
    // Kupóny — najprv podľa priority obchodu (.sk → .cz → ostatné), potom podľa názvu
    coupons.sort((a, b) => {
      const byShop = compareShopsByPriority({ name: a.shopName }, { name: b.shopName });
      if (byShop !== 0) return byShop;
      return skCollator.compare(a.title, b.title);
    });

    return Response.json(
      { products, shops, coupons: coupons.slice(0, 5) },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  }

  // ── Product search mode ──────────────────────────────────────
  if (mode === "product") {
    if (q.length < 1) return Response.json([]);
    try {
      const products = await feedManager.search(q);
      const results: ProductEntry[] = products.slice(0, 5).map(p => ({
        name: p.name,
        slug: "",
        category: p.category || "Produkt",
        domain: p.domain || "",
        price: p.price || "",
        url: p.affiliateUrl || p.url || "",
      }));
      return Response.json(results, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    } catch {
      return Response.json([]);
    }
  }

  // ── Shop search mode (default) ───────────────────────────────
  const result = await getAllShops();
  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
