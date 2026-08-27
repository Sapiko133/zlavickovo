import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";
import { feedManager, isRefreshableProvider } from "@/lib/feeds/FeedManager";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SESSION_COOKIE = "admin_session";
const LOCK_TTL_SECONDS = 300;

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return !!(adminPassword && session === adminPassword);
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { provider?: string } | null;
  const provider = body?.provider;
  if (!provider || !isRefreshableProvider(provider)) {
    return NextResponse.json({ error: "Neznámy provider" }, { status: 400 });
  }

  const lockKey = `feed:refresh:lock:${provider}`;
  const acquired = await redis.set(lockKey, Date.now(), { nx: true, ex: LOCK_TTL_SECONDS });
  if (acquired === null) {
    return NextResponse.json(
      { error: "Refresh tohto providera už prebieha. Skús o chvíľu." },
      { status: 409 },
    );
  }

  try {
    const result = await feedManager.importProvider(provider);
    return NextResponse.json({ ok: true, provider, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, provider, error: message.slice(0, 220) }, { status: 500 });
  } finally {
    try {
      await redis.del(lockKey);
    } catch {}
  }
}
