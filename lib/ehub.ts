import { unstable_cache } from "next/cache";

const BASE = "https://api.ehub.cz/v3";


function getCredentials() {
  return {
    partnerId: process.env.EHUB_PARTNER_ID ?? "",
    apiKey: process.env.EHUB_API_KEY ?? "",
  };
}

export interface EhubCoupon {
  id: string;
  title: string;
  code: string;
  description: string;
  discount: string;
  campaign_name: string;
  affiliate_link: string;
  valid_to: string | null;
  source: "ehub";
}

export interface EhubShop {
  id: string;
  name: string;
  web: string;
  logoUrl: string;
  affiliateLink: string;
  commission: string;
  category: string;
}

// eHub voucher API returns 0 results for this account — skip the call entirely
export async function getEhubCoupons(): Promise<EhubCoupon[]> { return []; }
export async function getEhubCouponsByShop(_shopName: string): Promise<EhubCoupon[]> { return []; }

async function fetchEhubShops(): Promise<EhubShop[]> {
  const { partnerId, apiKey } = getCredentials();
  if (!partnerId || !apiKey) return [];

  try {
    const res = await fetch(
      `${BASE}/publishers/${partnerId}/campaigns?apiKey=${apiKey}`,
      { next: { revalidate: 7200 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const campaigns: any[] = Array.isArray(data?.campaigns) ? data.campaigns : [];

    return campaigns.map((c: any) => {
      const commission = c.commissionGroups?.[0]?.commissions?.[0];
      const commissionStr = commission
        ? `${commission.value}${commission.valueType === "%" ? "%" : " CZK"}`
        : "";

      return {
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        web: String(c.web ?? ""),
        logoUrl: String(c.logoUrl ?? ""),
        affiliateLink: String(c.defaultLink ?? "#"),
        commission: commissionStr,
        category: String(c.categories?.[0]?.name ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export const getEhubShops = unstable_cache(
  fetchEhubShops,
  ["ehub-shops"],
  { revalidate: 7200 }
);
