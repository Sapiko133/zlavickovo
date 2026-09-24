import { getAllKnownShops, getStaticKnownShops } from "@/lib/all-shops";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import ObchodyClient, { type ShopItem } from "@/components/ObchodyClient";
import type { Metadata } from "next";
import { getShopRegistry, resolveShopSlugSync } from "@/lib/seo/shop-registry";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Obchody A–Z so zľavami a kupónmi",
  description: "Prehľad všetkých obchodov so zľavovými kódmi a kupónmi. Nájdi kupóny pre tvoj obľúbený eshop – zoradené podľa abecedy.",
  alternates: { canonical: "https://www.zlavickovo.sk/obchody" },
};

export default async function ObchodyPage() {
  // Jediný zdroj pravdy — lib/all-shops.ts (už deduplikované a zoradené)
  let knownShops: Awaited<ReturnType<typeof getAllKnownShops>> = [];
  try {
    knownShops = await getAllKnownShops();
  } catch {
    knownShops = getStaticKnownShops();
  }

  // Odkazy len na kanonické stránky (aliasy typu "(for cashbacks)" by viedli na 308).
  const reg = await getShopRegistry();
  const seen = new Set<string>();
  const allShops: ShopItem[] = knownShops.flatMap(s => {
    const slug = reg.bySlug.has(s.slug) ? s.slug : resolveShopSlugSync(reg, { slug: s.slug, name: s.name, domain: s.domain });
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    return [{ ...s, slug }];
  }).map(s => ({
    name: s.name,
    slug: s.slug,
    domain: s.domain || `${s.slug}.sk`,
    count: s.count || undefined,
    logoUrl: s.logoUrl || undefined,
    source: s.source,
  }));

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <Nav />
      <ObchodyClient shops={allShops} total={allShops.length} />
      <Footer />
    </div>
  );
}
