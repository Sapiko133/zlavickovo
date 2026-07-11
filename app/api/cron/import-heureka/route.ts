import { importHeurekaBatch, validateRetryFeedIds } from "@/lib/heureka/import";
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
    // freshRun=1 platí len pre mode=audit (založí nový run namiesto pokračovania
    // v partial rune); pri mode=full sa ignoruje — rovnako lenientne ako ostatné
    // parametre. Vynucuje importHeurekaBatch.
    const freshRun = req.nextUrl.searchParams.get("freshRun") === "1";

    // Cielený retry konkrétnych feedov: feedIds=id1,id2,... Povolený len pre
    // mode=full, ID musia byť v HEUREKA_FEEDS whiteliste. Beží ako samostatný
    // retry run (type=heureka_retry) s vyšším per-feed timeoutom — starý
    // partial run sa nemení a denný cron retry run neadoptuje.
    const feedIdsRaw = req.nextUrl.searchParams.get("feedIds");
    let feedIds: string[] | undefined;
    if (feedIdsRaw !== null) {
      if (mode !== "full") {
        return Response.json(
          { ok: false, error: "feedIds je povolené len pre mode=full" },
          { status: 400 }
        );
      }
      const requested = feedIdsRaw.split(",").map((id) => id.trim()).filter(Boolean);
      if (requested.length === 0) {
        return Response.json(
          { ok: false, error: "feedIds neobsahuje žiadne feed ID" },
          { status: 400 }
        );
      }
      const { valid, unknown } = validateRetryFeedIds(requested);
      if (unknown.length > 0) {
        return Response.json(
          {
            ok: false,
            error: "Neznáme feed ID — retry sa nespustil.",
            unknownFeedIds: unknown,
            validFeedIds: valid,
          },
          { status: 400 }
        );
      }
      feedIds = valid;
    }

    const result = await importHeurekaBatch({ mode, batchSize, parallelism, freshRun, feedIds });

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
