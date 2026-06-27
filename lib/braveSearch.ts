import { redis } from "@/lib/redis";
import { createHash } from "crypto";

export interface BraveResult {
  title: string;
  url: string;
  description: string;
  source?: string;
}

const CACHE_TTL = 60 * 60 * 24 * 30; // 30 dní

function cacheKey(query: string): string {
  const hash = createHash("md5").update(query.toLowerCase().trim()).digest("hex");
  return `brave_cache:${hash}`;
}

export async function braveSearch(query: string): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey || apiKey === "zatial_prazdne" || apiKey === "") return [];

  const key = cacheKey(query);

  try {
    const cached = await redis.get<BraveResult[]>(key);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          "X-Subscription-Token": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const results: BraveResult[] = (data.web?.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.description ?? "",
      source: "Nájdené na webe",
    }));

    if (results.length > 0) {
      try {
        await redis.set(key, results, { ex: CACHE_TTL });
      } catch {}
    }

    return results;
  } catch {
    return [];
  }
}
