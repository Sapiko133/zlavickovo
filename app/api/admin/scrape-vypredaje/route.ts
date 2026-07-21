import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { importScrapedVypredaje } from "@/lib/scrape-vypredaje";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SESSION_COOKIE = "admin_session";

async function isAuthed(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) return false;
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return session === adminPassword;
}

/** POST z admin panelu — spustí scrape výpredajov z vasekupony.sk. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  try {
    const result = await importScrapedVypredaje();
    const url = new URL("/admin/clanky", req.url);
    url.searchParams.set("scraped", String(result.created));
    url.searchParams.set("aff", String(result.monetizedAffiliate));
    url.searchParams.set("heu", String(result.monetizedHeureka));
    return NextResponse.redirect(url, 303);
  } catch (err: any) {
    const url = new URL("/admin/clanky", req.url);
    url.searchParams.set("scrapeError", (err?.message ?? "chyba").slice(0, 140));
    return NextResponse.redirect(url, 303);
  }
}

/** GET s CRON_SECRET — voliteľné automatické spustenie (rovnaké ako POST). */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await importScrapedVypredaje();
    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
