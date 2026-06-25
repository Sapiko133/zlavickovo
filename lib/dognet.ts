const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 8875;

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
  const all = await getCoupons();
  return all.filter((c: any) =>
    c.campaign?.name?.toLowerCase().includes(shopName.toLowerCase())
  );
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

export async function getShops() {
  const all = await getCoupons();
  const map = new Map<number, { id: number; name: string; count: number }>();
  for (const c of all) {
    const campaign = c.campaign;
    if (!campaign?.id || !campaign?.name) continue;
    const entry = map.get(campaign.id);
    if (entry) {
      entry.count++;
    } else {
      map.set(campaign.id, { id: campaign.id, name: campaign.name, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}