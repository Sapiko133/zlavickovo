import { createOrUpdateWatch } from "@/lib/heureka/price-watch";
import { isValidEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Vytvorenie sledovania ceny (§16). Verejný endpoint — používateľ zadá email +
 * podmienku (cieľová cena alebo percentuálny pokles). Base price sa NEBERIE od
 * používateľa, ale z aktuálnej ceny produktu (§17). Odhlásenie cez unsub_token
 * v každom upozornení (§23).
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = body?.email;
  const productUrl = body?.productUrl;
  if (!isValidEmail(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (typeof productUrl !== "string" || !productUrl.trim() || productUrl.length > 1000) {
    return Response.json({ ok: false, error: "invalid_product" }, { status: 400 });
  }

  // Podmienky — clampované do rozumných hraníc (§27 nezneužiteľné vstupy).
  let targetPrice: number | null = null;
  if (body?.targetPrice != null) {
    const n = Number(body.targetPrice);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      return Response.json({ ok: false, error: "invalid_target_price" }, { status: 400 });
    }
    targetPrice = Math.round(n * 100) / 100;
  }
  let targetDropPct: number | null = null;
  if (body?.targetDropPct != null) {
    const n = Math.floor(Number(body.targetDropPct));
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      return Response.json({ ok: false, error: "invalid_target_drop" }, { status: 400 });
    }
    targetDropPct = n;
  }
  if (targetPrice === null && targetDropPct === null) {
    return Response.json({ ok: false, error: "no_condition" }, { status: 400 });
  }

  try {
    const result = await createOrUpdateWatch({ email, productUrl, targetPrice, targetDropPct });
    if (!result.ok) {
      const status = result.error === "product_not_found" ? 404 : 400;
      return Response.json({ ok: false, error: result.error }, { status });
    }
    // Token sa NEVRACIA klientovi — slúži len do odhlasovacích odkazov v emaili.
    return Response.json({ ok: true, basePrice: result.basePrice, currency: result.currency });
  } catch (err: any) {
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
