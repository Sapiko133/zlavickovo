import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { saveManualFeeds, deleteCustomFeed } from "@/lib/feeds/AffialDiscovery";

const SESSION_COOKIE = "admin_session";

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return !!(adminPassword && session === adminPassword);
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { urls } = await req.json() as { urls: string[] };
  if (!Array.isArray(urls)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const saved = await saveManualFeeds(urls);
  return NextResponse.json({ saved });
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json() as { url: string };
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  await deleteCustomFeed(url);
  return NextResponse.json({ ok: true });
}
