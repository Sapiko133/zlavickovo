import { NextRequest } from "next/server";
import { generateSaleArticles } from "@/lib/sale-articles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron každých 6h — vygeneruje/aktualizuje články o výpredajoch obchodov
 * (grid zľavnených produktov + affiliate CTA). Skončené akcie deaktivuje.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateSaleArticles();
    return Response.json({
      ok: true,
      ...result,
      message: `Články o výpredajoch: ${result.created.length} vytvorených/aktualizovaných, ${result.deactivated.length} deaktivovaných (z ${result.scannedDomains} obchodov).`,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
