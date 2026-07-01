import { getShops } from "@/lib/dognet";
import { normalizeShopSlug } from "@/lib/slug";
import { getEhubShops } from "@/lib/ehub";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { getShopDomain } from "@/lib/shop-domains";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import ObchodyClient, { type ShopItem } from "@/components/ObchodyClient";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Všetky obchody A-Z | Zlavickovo.sk",
  description: "Prehľad všetkých obchodov so zľavovými kódmi a kupónmi. Nájdi kupóny pre tvoj obľúbený eshop – zoradené podľa abecedy.",
  alternates: { canonical: "https://zlavickovo.sk/obchody" },
};

function shopSlug(name: string) {
  return normalizeShopSlug(name);
}

export default async function ObchodyPage() {
  let dognetShops: { id: number; name: string; count: number; logoUrl?: string }[] = [];
  let ehubShops: Awaited<ReturnType<typeof getEhubShops>> = [];

  try {
    [dognetShops, ehubShops] = await Promise.all([
      getShops().catch(() => []),
      getEhubShops().catch(() => []),
    ]);
  } catch {}

  const seenNames = new Set<string>();
  const seenSlugs = new Set<string>();
  const allShops: ShopItem[] = [];

  // 1. Dognet (primary — has coupon counts)
  for (const s of dognetShops) {
    const key = s.name.toLowerCase().trim();
    const slug = shopSlug(s.name);
    if (seenNames.has(key) || seenSlugs.has(slug)) continue;
    seenNames.add(key);
    seenSlugs.add(slug);
    const domain = getShopDomain(s.name) || `${slug}.sk`;
    allShops.push({ name: s.name, slug, domain, count: s.count || undefined, logoUrl: s.logoUrl || undefined, source: "dognet" });
  }

  // 2. eHub
  for (const s of ehubShops) {
    if (!s.name) continue;
    const key = s.name.toLowerCase().trim();
    const rawDomain = s.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    const slug = rawDomain
      ? rawDomain.replace(/\.(sk|cz|eu|com|net|org)$/, "").replace(/\./g, "-")
      : shopSlug(s.name);
    if (seenNames.has(key) || seenSlugs.has(slug)) continue;
    seenNames.add(key);
    seenSlugs.add(slug);
    const domain = rawDomain || getShopDomain(s.name) || `${slug}.sk`;
    allShops.push({ name: s.name, slug, domain, commission: s.commission, logoUrl: s.logoUrl || undefined, source: "ehub" });
  }

  // 3. Affial (static, has domain + commission)
  for (const s of AFFIAL_SHOPS) {
    const key = s.name.toLowerCase().trim();
    const slug = s.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-");
    if (seenNames.has(key) || seenSlugs.has(slug)) continue;
    seenNames.add(key);
    seenSlugs.add(slug);
    allShops.push({ name: s.name, slug, domain: s.domain, commission: s.commission, source: "affial" });
  }

  // Sort alphabetically (sk locale)
  allShops.sort((a, b) => a.name.localeCompare(b.name, "sk", { sensitivity: "base" }));

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <Nav />
      <ObchodyClient shops={allShops} total={allShops.length} />
      <Footer />
    </div>
  );
}
