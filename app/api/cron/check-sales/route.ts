import { NextRequest } from "next/server";
import { generateSaleArticles } from "@/lib/sale-articles";
import {
  publishPendingFacebookActions,
  queueFacebookArticles,
  queueFacebookFallbackArticles,
} from "@/lib/facebook";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Denný cron — vygeneruje/aktualizuje články o výpredajoch obchodov
 * (grid zľavnených produktov + affiliate CTA). Skončené akcie deaktivuje.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  if (
    !cronSecret ||
    (authHeader !== `Bearer ${cronSecret}` && cronHeader !== cronSecret)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateSaleArticles();
    const queuedForFacebook = await queueFacebookArticles(result.created);
    const queuedFallbackForFacebook = queuedForFacebook === 0
      ? await queueFacebookFallbackArticles(2)
      : 0;
    const facebook = await publishPendingFacebookActions();
    return Response.json({
      ok: true,
      ...result,
      queuedForFacebook,
      queuedFallbackForFacebook,
      facebook,
      message: `Akčné články: ${result.created.length} vytvorených/aktualizovaných, ${result.deactivated.length} deaktivovaných (${result.scannedActions} akcií, ${result.scannedDomains} produktových domén).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
