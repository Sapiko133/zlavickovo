import { importHeurekaBatch } from "@/lib/heureka/import";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mode = req.nextUrl.searchParams.get("mode") === "audit" ? "audit" : "full";
    const batchSize = Number.parseInt(req.nextUrl.searchParams.get("batchSize") ?? "", 10);
    const parallelism = Number.parseInt(req.nextUrl.searchParams.get("parallelism") ?? "", 10);
    const result = await importHeurekaBatch({ mode, batchSize, parallelism });

    if (result.status === "locked") {
      return Response.json(result, { status: 409 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
