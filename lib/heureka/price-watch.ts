import { randomUUID } from "node:crypto";
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
  productId: number;
  domain: string;
  productName: string;
  currentPrice: number;
  currency: SupportedCurrency;
  reason: WatchReason;
  affiliateUrl: string | null;
  unsubToken: string | null;
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
      w.id, w.email, w.product_url, w.domain, w.currency, w.unsub_token,
      w.target_price::float8      AS target_price,
      w.target_drop_pct           AS target_drop_pct,
      w.base_price::float8        AS base_price,
      w.last_notified_price::float8 AS last_notified_price,
      p.id            AS product_id,
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
        productId: Number(r.product_id),
        domain: r.domain ?? "",
        productName: r.product_name ?? "",
        currentPrice: priceNum,
        currency,
        reason: evalRes.reason,
        affiliateUrl: r.affiliate_url ?? null,
        unsubToken: r.unsub_token ?? null,
      });
    }
  }
  return triggered;
}

export interface CreateWatchInput {
  email: string;
  productUrl: string;
  targetPrice?: number | null;
  targetDropPct?: number | null;
}

export type CreateWatchResult =
  | { ok: true; basePrice: number; currency: SupportedCurrency; unsubToken: string }
  | { ok: false; error: "product_not_found" | "product_price_unavailable" | "no_condition" };

/**
 * Vytvorí/aktualizuje watch. Base price + mena sa berú z AKTUÁLNEJ ceny produktu
 * (nie od používateľa — §17 žiadne fiktívne ceny). Jeden watch na (email, produkt).
 * unsub_token pre bezpečné odhlásenie (§23) sa zachová pri update.
 */
export async function createOrUpdateWatch(
  input: CreateWatchInput,
  sqlClient?: SqlClient
): Promise<CreateWatchResult> {
  const sql = sqlClient ?? getDb();

  const [product] = (await sql`
    SELECT name, price, currency_code, domain FROM hk_products WHERE url = ${input.productUrl} LIMIT 1
  `) as any[];
  if (!product) return { ok: false, error: "product_not_found" };

  const basePrice = parsePriceValue(product.price);
  const currency = resolveProductCurrency(product.price, product.currency_code, product.domain);
  if (basePrice === null || !currency) return { ok: false, error: "product_price_unavailable" };

  const targetPrice = input.targetPrice ?? null;
  const targetDropPct = input.targetDropPct ?? null;
  if (targetPrice === null && targetDropPct === null) return { ok: false, error: "no_condition" };

  const token = randomUUID();
  await sql`
    INSERT INTO price_watches
      (email, product_url, domain, target_price, target_drop_pct, base_price, currency, active, unsub_token)
    VALUES
      (${input.email}, ${input.productUrl}, ${product.domain ?? ""}, ${targetPrice}, ${targetDropPct},
       ${basePrice.toFixed(2)}, ${currency}, true, ${token})
    ON CONFLICT (email, product_url) DO UPDATE SET
      target_price    = EXCLUDED.target_price,
      target_drop_pct = EXCLUDED.target_drop_pct,
      base_price      = EXCLUDED.base_price,
      currency        = EXCLUDED.currency,
      active          = true,
      unsub_token     = COALESCE(price_watches.unsub_token, EXCLUDED.unsub_token)
  `;
  return { ok: true, basePrice, currency, unsubToken: token };
}

/** Odhlásenie watchu podľa tokenu (§23). Vráti true ak sa niečo deaktivovalo. */
export async function deactivateWatchByToken(token: string, sqlClient?: SqlClient): Promise<boolean> {
  if (!token) return false;
  const sql = sqlClient ?? getDb();
  const rows = (await sql`
    UPDATE price_watches SET active = false WHERE unsub_token = ${token} AND active RETURNING id
  `) as any[];
  return rows.length > 0;
}
