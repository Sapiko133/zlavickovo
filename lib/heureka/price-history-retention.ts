import { getDb } from "@/lib/db";

type SqlClient = ReturnType<typeof getDb>;

// Produkčná retencia cenovej histórie. História rastie ~87 000 riadkov/deň,
// takže staré snapshoty treba mazať, inak tabuľka neobmedzene rastie.
export const RETENTION_DAYS = 120;

// Postgres nemá DELETE ... LIMIT, preto mažeme po bezpečných dávkach cez id
// subquery. Jedna dávka = jeden HTTP round-trip na Neon; menšie dávky = kratšie
// zámky, viac dávok = viac latencie. 10 000/dávka a 20 dávok/request je
// konzervatívny strop (max 200 000 riadkov / spustenie).
export const DEFAULT_BATCH_SIZE = 10_000;
export const DEFAULT_MAX_BATCHES = 20;

export interface CleanupOptions {
  retentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
  // Testovací DB stub; produkčne getDb().
  sqlClient?: SqlClient;
}

export interface CleanupResult {
  deletedRows: number;
  batches: number;
  hasMore: boolean;
  retentionDays: number;
  durationMs: number;
}

function clampInt(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  return rounded < min ? min : rounded;
}

/**
 * Zmaže snapshoty cenovej histórie staršie než `retentionDays` po bezpečných
 * dávkach. Vždy porovnáva `recorded_at` (nie `recorded_day`), maže najstaršie
 * riadky ako prvé a jednu dávku obmedzuje na `batchSize` cez id subquery
 * (Postgres nemá DELETE LIMIT). Používa index product_price_history_recorded_at_idx.
 *
 * Idempotentná: po zmazaní backlogu ďalšie spustenie zmaže 0 riadkov.
 * Nikdy nepoužíva TRUNCATE, nemaže podľa recorded_day bez kontroly recorded_at
 * a nedotýka sa hk_products.
 *
 * Skončí, keď dávka zmaže menej než `batchSize` (backlog vyčerpaný) alebo keď
 * sa dosiahne `maxBatches` (potom hasMore=true — treba ďalší request).
 */
export async function cleanupPriceHistory(opts: CleanupOptions = {}): Promise<CleanupResult> {
  const retentionDays = clampInt(opts.retentionDays, RETENTION_DAYS, 1);
  const batchSize = clampInt(opts.batchSize, DEFAULT_BATCH_SIZE, 1);
  const maxBatches = clampInt(opts.maxBatches, DEFAULT_MAX_BATCHES, 1);
  const sql = opts.sqlClient ?? getDb();

  const start = Date.now();
  let deletedRows = 0;
  let batches = 0;
  let hasMore = false;

  for (let i = 0; i < maxBatches; i++) {
    const rows = (await sql`
      DELETE FROM product_price_history
      WHERE id IN (
        SELECT id
        FROM product_price_history
        WHERE recorded_at < now() - make_interval(days => ${retentionDays}::int)
        ORDER BY recorded_at ASC
        LIMIT ${batchSize}
      )
      RETURNING id
    `) as { id: number }[];

    const n = rows.length;
    batches += 1;
    deletedRows += n;

    if (n < batchSize) {
      // Neúplná dávka → backlog vyčerpaný, nič viac nezostáva.
      hasMore = false;
      break;
    }
    // Plná dávka → pravdepodobne zostáva ďalší backlog nad rámec tohto behu.
    hasMore = true;
  }

  return {
    deletedRows,
    batches,
    hasMore,
    retentionDays,
    durationMs: Date.now() - start,
  };
}
