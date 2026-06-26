import { redis } from "@/lib/redis";

const ipLimiter = new Map<string, number>(); // ip → last click timestamp

export async function POST(req: Request) {
  try {
    const { code, shop } = await req.json();
    if (!code || !shop) return Response.json({ ok: false });

    // Rate limit: 1 click per code per IP per hour
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const limitKey = `${ip}:${shop}:${code}`;
    const lastClick = ipLimiter.get(limitKey) || 0;
    if (Date.now() - lastClick < 3_600_000) return Response.json({ ok: true });
    ipLimiter.set(limitKey, Date.now());

    // Increment in KV — if KV not configured, this throws and we catch it
    const key = `clicks:${shop.toLowerCase()}:${code.toUpperCase()}`;
    await redis.incr(key);

    return Response.json({ ok: true });
  } catch {
    // KV not available or any other error — graceful fallback
    return Response.json({ ok: true });
  }
}
