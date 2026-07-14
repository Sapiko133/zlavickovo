import { NextRequest } from "next/server";
import { computePipelineHealth } from "@/lib/heureka/pipeline-health";

export const dynamic = "force-dynamic";

/**
 * Stráž zdravia dátového pipeline (PROJECT_VISION §19/§31). Read-only.
 *   - Authorization: Bearer <CRON_SECRET> (rovnaká schéma ako ostatné admin/cron)
 *   - HTTP 200  → ok / warn (warn = informatívne, v tele reasons[])
 *   - HTTP 503  → critical (import nebežal, história sa nehromadí, výpadok dát)
 *
 * Volá sa ako 3. krok GitHub Actions po importe: 503 zhodí job (red X + email),
 * takže tiché zlyhanie VÝSTUPU importu sa stane hlučným.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await computePipelineHealth();
    const httpStatus = health.status === "critical" ? 503 : 200;
    return Response.json({ ok: health.status !== "critical", ...health }, { status: httpStatus });
  } catch (err: any) {
    // Nedostupná DB / zlyhanie dotazu je samo o sebe kritické.
    return Response.json(
      { ok: false, status: "critical", checks: [], reasons: [`health check failed: ${err?.message ?? String(err)}`] },
      { status: 503 }
    );
  }
}
