import { getAffialCoupons } from "@/lib/affial";
import { getCjCouponsByShop } from "@/lib/cj";

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;

let token: string | null = null;

export async function getToken(): Promise<string> {
  if (token) return token;
  
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.DOGNET_EMAIL,
      password: process.env.DOGNET_PASSWORD,
    }),
  });
  
  const data = await res.json();
  token = data.token || data.data?.token;
  if (!token) throw new Error("Dognet login zlyhal");
  return token;
}

export async function getCoupons() {
  const t = await getToken();
  
  const res = await fetch(`${API_BASE}/coupons/filter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${t}`,
    },
    body: JSON.stringify({
      ad_channel_id: AD_CHANNEL_ID,
      from_joined_campaigns: true,
      filter: [{ validity: { eq: "present" } }],
      expand: "campaign",
      "per-page": 500,
    }),
  });
  
  const data = await res.json();
  return data.data || [];
}

export async function getCouponsByShop(shopName: string) {
  const [dognetAll, affialAll, cjAll] = await Promise.all([
    getCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getCjCouponsByShop(shopName).catch(() => []),
  ]);
  const lower = shopName.toLowerCase();

  const dognet = dognetAll
    .filter((c: any) => c.campaign?.name?.toLowerCase().includes(lower))
    .map((c: any) => ({ ...c, source: "dognet" }));

  const affial = affialAll.filter((c: any) =>
    c.campaign_name?.toLowerCase().includes(lower)
  );

  const cj = cjAll.map((c: any) => ({
    id: c.id,
    code: c.code,
    title: c.description,
    name: c.description,
    type: 1,
    affiliate_link: c.link,
    url: c.link,
    valid_to: c.endDate || null,
    campaign: { name: c.advertiserName },
    campaign_name: c.advertiserName,
    source: "cj",
  }));

  const seenCodes = new Set(
    [...dognet, ...cj].map((c: any) => c.code?.toUpperCase()).filter(Boolean)
  );
  const uniqueAffial = affial.filter(
    (c: any) => !c.code || !seenCodes.has(c.code.toUpperCase())
  );

  return [...dognet, ...cj, ...uniqueAffial];
}

export async function getLatestCoupons(limit = 6) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.code)
    .slice(0, limit);
}

// Type 1 = Zľava, Type 3 = Výpredaj — for homepage feeds
export async function getCouponsFeed(limit = 12) {
  const all = await getCoupons();
  return all.slice(0, limit);
}

export async function getSalesCoupons(limit = 6) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.type === 3 || c.type === 1)
    .slice(0, limit);
}

export async function getLatestSales(limit = 8) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.type === 3)
    .sort((a: any, b: any) => {
      const da = new Date(a.valid_from || 0).getTime();
      const db = new Date(b.valid_from || 0).getTime();
      return db - da;
    })
    .slice(0, limit);
}

export async function getCashbackShops() {
  try {
    const t = await getToken();
    const res = await fetch(`${API_BASE}/campaigns/filter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${t}`,
      },
      body: JSON.stringify({
        filter: [{ ad_channel_type_id: { eq: 14 } }],
        "per-page": 50,
      }),
    });
    const data = await res.json();
    const campaigns: any[] = data.data || [];
    return campaigns
      .filter((c: any) => c.name)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        cashback: c.cashback_value ?? c.commission ?? null,
        slug: c.name.toLowerCase().replace(/\s+/g, "-"),
        affiliate_link: c.url ?? c.website_url ?? "#",
      }));
  } catch {
    return [];
  }
}

async function getCouponsForChannel(channelId: number) {
  try {
    const t = await getToken();
    const res = await fetch(`${API_BASE}/coupons/filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
      body: JSON.stringify({
        ad_channel_id: channelId,
        from_joined_campaigns: true,
        filter: [{ validity: { eq: "present" } }],
        expand: "campaign",
        "per-page": 500,
      }),
    });
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getShops() {
  try {
    const t = await getToken();

    // Run coupon channel + campaigns endpoint in parallel
    const [ch1, cmpRes] = await Promise.allSettled([
      getCouponsForChannel(33415),
      fetch(`${API_BASE}/campaigns/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
        body: JSON.stringify({ "per-page": 200 }),
      }).then(r => r.json()).catch(() => null),
    ]);

    // Build map from shops with active coupons (higher priority, have coupon count)
    const map = new Map<string, { id: number; name: string; count: number; logoUrl?: string }>();
    const coupons = ch1.status === "fulfilled" ? ch1.value : [];
    for (const c of coupons) {
      const cam = c.campaign;
      if (!cam?.name) continue;
      const key = cam.name.toLowerCase();
      const entry = map.get(key);
      if (entry) { entry.count++; }
      else { map.set(key, { id: cam.id ?? 0, name: cam.name, count: 1, logoUrl: cam.logo_url }); }
    }

    // Add all campaigns without coupons (fill remaining 200 slots)
    if (cmpRes.status === "fulfilled" && Array.isArray(cmpRes.value?.data)) {
      for (const c of cmpRes.value.data) {
        if (!c.name) continue;
        const key = c.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: c.id ?? 0, name: c.name, count: 0, logoUrl: c.logo_url });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}