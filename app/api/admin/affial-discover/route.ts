import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discoverFromPatterns, discoverFromLogin } from "@/lib/feeds/AffialDiscovery";

const SESSION_COOKIE = "admin_session";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "patterns";

  if (mode === "login") {
    const result = await discoverFromLogin();
    return NextResponse.json(result);
  }

  const result = await discoverFromPatterns();
  return NextResponse.json(result);
}
