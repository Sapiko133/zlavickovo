import { redis } from "@/lib/redis";

const ipLimiter = new Map<string, number>(); // ip → last click timestamp

export async function POST(req: Request) {
  try {
    const { code, shop, affiliate_link } = await req.json();
    if (!shop) return Response.json({ ok: false });

    // Rate limit: 1 click per code per IP per hour
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const limitKey = `${ip}:${shop}:${code || "_deal"}`;
    const lastClick = ipLimiter.get(limitKey) || 0;
    if (Date.now() - lastClick < 3_600_000) return Response.json({ ok: true });
    ipLimiter.set(limitKey, Date.now());

    // Increment click counter
    if (code) {
      const key = `clicks:${shop.toLowerCase()}:${code.toUpperCase()}`;
      await redis.incr(key);
    }

    // Store in recent reveals list (last 10)
    const reveal = JSON.stringify({ shop, code: code || "", affiliate_link: affiliate_link || "", ts: Date.now() });
    await redis.lpush("recent_reveals", reveal);
    await redis.ltrim("recent_reveals", 0, 9);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
