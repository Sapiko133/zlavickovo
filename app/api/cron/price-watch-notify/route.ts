import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getTriggeredWatches } from "@/lib/heureka/price-watch";
import { toProductSlug } from "@/lib/heureka/query";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = "https://www.zlavickovo.sk";

function fmtPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2).replace(".", ",")} ${currency === "CZK" ? "Kč" : "€"}`;
}

/**
 * Notifikačný krok sledovania ceny (§16 automatizácia, §23). Nájde spustené watche
 * (cena klesla na cieľ/percento), pošle email s monetizovaným odkazom na produktovú
 * stránku a odhlasovacím odkazom, a zapíše last_notified (dedup proti spamu).
 * Bez RESEND_API_KEY sa email neodošle a last_notified sa nezapíše → skúsi znovu.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();
    const triggered = await getTriggeredWatches(sql);
    let sent = 0;
    let failed = 0;

    for (const w of triggered) {
      const productUrl = `${BASE}/produkt/${toProductSlug(w.productName, w.productId)}`;
      const unsubUrl = w.unsubToken
        ? `${BASE}/api/price-watch/unsubscribe?token=${encodeURIComponent(w.unsubToken)}`
        : `${BASE}`;
      const price = fmtPrice(w.currentPrice, w.currency);

      const text =
        `Dobrá správa! Cena klesla na produkt, ktorý sleduješ:\n\n` +
        `${w.productName}\nAktuálna cena: ${price} (${w.domain})\n\n` +
        `Pozri najvýhodnejšiu ponuku: ${productUrl}\n\n` +
        `Ak už nechceš dostávať upozornenia na tento produkt, odhlás sa tu:\n${unsubUrl}`;

      const res = await sendEmail({
        to: w.email,
        subject: `Cena klesla: ${w.productName.slice(0, 60)} – ${price}`,
        text,
      });

      if (res.sent) {
        await sql`
          UPDATE price_watches
          SET last_notified_at = now(), last_notified_price = ${w.currentPrice.toFixed(2)}
          WHERE id = ${w.id}
        `;
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return Response.json({ ok: true, checked: triggered.length, sent, failed });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
