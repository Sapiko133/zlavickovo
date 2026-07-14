import { getDb } from "@/lib/db";
import { parsePriceValue, resolveProductCurrency, type SupportedCurrency } from "@/lib/price";

type SqlClient = ReturnType<typeof getDb>;

/**
 * Sledovanie ceny (PROJECT_VISION §16). Táto vrstva rieši IBA spoľahlivé uloženie
 * a VYHODNOTENIE podmienok — „potom automatizáciu" (notifikácie §23) je samostatný
 * krok. Žiadne cross-currency porovnanie (§9): mena watchu sa musí zhodovať s menou
 * aktuálnej ceny, inak sa nespúšťa.
 */

export interface PriceWatch {
  targetPrice: number | null;    // cieľová cena v mene watchu
  targetDropPct: number | null;  // alebo percentuálny pokles od base_price
  basePrice: number | null;      // cena pri vytvorení watchu (pre percentuálny pokles)
  currency: SupportedCurrency;
  lastNotifiedPrice: number | null; // cena pri poslednom upozornení (dedup proti spamu)
}

export type WatchReason = "target_price" | "target_drop";

export interface WatchEvaluation {
  triggered: boolean;
  reason: WatchReason | null;
  currentPrice: number;
}

/**
 * Vyhodnotí, či sa má PRÁVE TERAZ poslať upozornenie. Podmienka splnená = cena
 * klesla na cieľ alebo o cieľové percento. Dedup (§23 „iba relevantné zmeny"):
 * ak sme už upozornili, znovu upozorníme len ak cena klesla EŠTE nižšie.
 */
export function evaluateWatch(
  watch: PriceWatch,
  currentPrice: number,
  currentCurrency: SupportedCurrency
): WatchEvaluation {
  const miss: WatchEvaluation = { triggered: false, reason: null, currentPrice };

  // §9: rôzne meny sa neporovnávajú.
  if (currentCurrency !== watch.currency) return miss;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return miss;

  let reason: WatchReason | null = null;
  if (watch.targetPrice !== null && currentPrice <= watch.targetPrice) {
    reason = "target_price";
  } else if (
    watch.targetDropPct !== null &&
    watch.basePrice !== null &&
    watch.basePrice > 0
  ) {
    const dropPct = ((watch.basePrice - currentPrice) / watch.basePrice) * 100;
    if (dropPct >= watch.targetDropPct) reason = "target_drop";
  }
  if (!reason) return miss;

  // Už sme upozornili pri tejto alebo nižšej cene → nespamuj, len ďalší pokles.
  if (watch.lastNotifiedPrice !== null && currentPrice >= watch.lastNotifiedPrice) {
    return miss;
  }

  return { triggered: true, reason, currentPrice };
}

export interface TriggeredWatch {
  id: number;
  email: string;
  productUrl: string;
  domain: string;
  productName: string;
  currentPrice: number;
  currency: SupportedCurrency;
  reason: WatchReason;
  affiliateUrl: string | null;
}

/**
 * Načíta aktívne watche, spáruje s aktuálnou cenou produktu (hk_products) a vráti
 * tie, ktoré majú byť upozornené. Read-only vyhodnotenie — zápis last_notified rieši
 * až notifikačný krok (automatizácia).
 */
export async function getTriggeredWatches(sqlClient?: SqlClient): Promise<TriggeredWatch[]> {
  const sql = sqlClient ?? getDb();
  const rows = (await sql`
    SELECT
      w.id, w.email, w.product_url, w.domain, w.currency,
      w.target_price::float8      AS target_price,
      w.target_drop_pct           AS target_drop_pct,
      w.base_price::float8        AS base_price,
      w.last_notified_price::float8 AS last_notified_price,
      p.name          AS product_name,
      p.price         AS raw_price,
      p.currency_code AS currency_code,
      p.affiliate_url AS affiliate_url
    FROM price_watches w
    JOIN hk_products p ON p.url = w.product_url
    WHERE w.active
  `) as any[];

  const triggered: TriggeredWatch[] = [];
  for (const r of rows) {
    const priceNum = parsePriceValue(r.raw_price);
    const currency = resolveProductCurrency(r.raw_price, r.currency_code, r.domain);
    if (priceNum === null || !currency) continue;

    const evalRes = evaluateWatch(
      {
        targetPrice: r.target_price ?? null,
        targetDropPct: r.target_drop_pct ?? null,
        basePrice: r.base_price ?? null,
        currency: r.currency,
        lastNotifiedPrice: r.last_notified_price ?? null,
      },
      priceNum,
      currency
    );
    if (evalRes.triggered && evalRes.reason) {
      triggered.push({
        id: r.id,
        email: r.email,
        productUrl: r.product_url,
        domain: r.domain ?? "",
        productName: r.product_name ?? "",
        currentPrice: priceNum,
        currency,
        reason: evalRes.reason,
        affiliateUrl: r.affiliate_url ?? null,
      });
    }
  }
  return triggered;
}
