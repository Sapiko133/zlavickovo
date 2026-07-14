import { getDb } from "@/lib/db";
import { getPriceHistoryStats } from "./price-history";

type SqlClient = ReturnType<typeof getDb>;

/**
 * Stráž zdravia dátového pipeline (PROJECT_VISION §19 integrita importu, §31
 * „env chyba/pipeline potichu zlyhá" = kritická trieda). Import ZLYHANIE už hlási
 * GitHub Actions (red X + email). Táto stráž pokrýva opačný prípad: import
 * „uspeje", ale VÝSTUP je nezdravý — produkty zastarali, cenová história sa
 * nehromadí, alebo väčšina feedov chybuje. Čisto read-only agregácie.
 */

export type HealthStatus = "ok" | "warn" | "critical";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
}

export interface PipelineHealth {
  status: HealthStatus; // najhorší z checkov
  checks: HealthCheck[];
  reasons: string[];     // dôvody pre warn/critical (pre logy/alert)
}

export interface PipelineHealthInput {
  productTotal: number;
  importAgeHours: number | null;                // null = neznáme (žiadne produkty)
  priceHistoryLatestDayAgeDays: number | null;  // null = prázdna história
  priceHistoryDistinctDays: number;
  feedTotal: number;
  feedErrored: number;
}

// Prahy. Denný import (07:00 UTC) → čerstvý updated_at; > ~30h znamená vynechaný beh.
const MIN_PRODUCTS = 5000;         // ochrana pred výpadkom/wipe (DB má ~109k)
const IMPORT_AGE_WARN_H = 26;
const IMPORT_AGE_CRIT_H = 30;
const PH_AGE_WARN_D = 1;           // 1 deň bez nového snapshotu (dnes pred behom bežné)
const PH_AGE_CRIT_D = 2;           // ≥2 dni → vynechaný celý deň, história sa nehromadí
const FEED_ERROR_WARN_RATIO = 0.5;

const RANK: Record<HealthStatus, number> = { ok: 0, warn: 1, critical: 2 };

/**
 * Čistá vyhodnocovacia logika — bez DB, testovateľná. Celkový status = najhorší
 * jednotlivý check.
 */
export function evaluatePipelineHealth(i: PipelineHealthInput): PipelineHealth {
  const checks: HealthCheck[] = [];

  // 1. Objem produktov — ochrana pred tichým výpadkom/wipe dát.
  checks.push(
    i.productTotal < MIN_PRODUCTS
      ? { name: "products", status: "critical", detail: `hk_products=${i.productTotal} < ${MIN_PRODUCTS} (možný výpadok dát)` }
      : { name: "products", status: "ok", detail: `hk_products=${i.productTotal}` }
  );

  // 2. Čerstvosť importu (max updated_at) — chytí „denný import nebežal".
  if (i.importAgeHours === null) {
    checks.push({ name: "import_freshness", status: "critical", detail: "neznámy čas posledného importu (žiadne produkty)" });
  } else if (i.importAgeHours > IMPORT_AGE_CRIT_H) {
    checks.push({ name: "import_freshness", status: "critical", detail: `posledný import pred ${i.importAgeHours.toFixed(1)}h (> ${IMPORT_AGE_CRIT_H}h — denný import zrejme nebežal)` });
  } else if (i.importAgeHours > IMPORT_AGE_WARN_H) {
    checks.push({ name: "import_freshness", status: "warn", detail: `posledný import pred ${i.importAgeHours.toFixed(1)}h` });
  } else {
    checks.push({ name: "import_freshness", status: "ok", detail: `posledný import pred ${i.importAgeHours.toFixed(1)}h` });
  }

  // 3. Hromadenie cenovej histórie — chytí „import uspel, ale snapshot nepribudol".
  if (i.priceHistoryLatestDayAgeDays === null) {
    checks.push({ name: "price_history_growth", status: "warn", detail: "cenová história je prázdna" });
  } else if (i.priceHistoryLatestDayAgeDays >= PH_AGE_CRIT_D) {
    checks.push({ name: "price_history_growth", status: "critical", detail: `posledný snapshot pred ${i.priceHistoryLatestDayAgeDays} dňami (nehromadí sa)` });
  } else if (i.priceHistoryLatestDayAgeDays >= PH_AGE_WARN_D) {
    checks.push({ name: "price_history_growth", status: "warn", detail: `posledný snapshot pred ${i.priceHistoryLatestDayAgeDays} dňami` });
  } else {
    checks.push({ name: "price_history_growth", status: "ok", detail: `posledný snapshot pred ${i.priceHistoryLatestDayAgeDays} dňami, dní spolu=${i.priceHistoryDistinctDays}` });
  }

  // 4. Chybovosť feedov — väčšina feedov v chybe = zdroj sa kazí.
  const ratio = i.feedTotal > 0 ? i.feedErrored / i.feedTotal : 0;
  checks.push(
    i.feedTotal > 0 && ratio > FEED_ERROR_WARN_RATIO
      ? { name: "feed_errors", status: "warn", detail: `${i.feedErrored}/${i.feedTotal} feedov s chybou (${Math.round(ratio * 100)}%)` }
      : { name: "feed_errors", status: "ok", detail: `${i.feedErrored}/${i.feedTotal} feedov s chybou` }
  );

  const status = checks.reduce<HealthStatus>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), "ok");
  const reasons = checks.filter((c) => c.status !== "ok").map((c) => `${c.name}: ${c.detail}`);
  return { status, checks, reasons };
}

/**
 * Zozbiera signály z DB (read-only agregácie) a vyhodnotí zdravie pipeline.
 */
export async function computePipelineHealth(sqlClient?: SqlClient): Promise<PipelineHealth> {
  const sql = sqlClient ?? getDb();

  const [prod] = (await sql`
    SELECT
      count(*)::int AS total,
      EXTRACT(EPOCH FROM (now() - max(updated_at))) / 3600.0 AS age_hours
    FROM hk_products
  `) as { total: number; age_hours: number | string | null }[];

  const [feeds] = (await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE coalesce(error_count, 0) > 0 OR (last_error IS NOT NULL AND last_error <> '')
      )::int AS errored
    FROM hk_feeds
  `) as { total: number; errored: number }[];

  const ph = await getPriceHistoryStats(sql);

  let phAgeDays: number | null = null;
  if (ph.latestRecordedDay) {
    const latest = new Date(ph.latestRecordedDay);
    const now = new Date();
    const dayUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    phAgeDays = Math.floor((dayUTC(now) - dayUTC(latest)) / 86_400_000);
  }

  return evaluatePipelineHealth({
    productTotal: prod?.total ?? 0,
    importAgeHours: prod?.age_hours == null ? null : Number(prod.age_hours),
    priceHistoryLatestDayAgeDays: phAgeDays,
    priceHistoryDistinctDays: ph.distinctDays,
    feedTotal: feeds?.total ?? 0,
    feedErrored: feeds?.errored ?? 0,
  });
}
