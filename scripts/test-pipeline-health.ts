/**
 * Testy stráže zdravia pipeline (čistá logika evaluatePipelineHealth).
 * Spustenie: npx tsx scripts/test-pipeline-health.ts
 */
import assert from "node:assert/strict";
import { evaluatePipelineHealth, type PipelineHealthInput } from "../lib/heureka/pipeline-health.ts";

const healthy: PipelineHealthInput = {
  productTotal: 109000,
  importAgeHours: 2,
  priceHistoryLatestDayAgeDays: 0,
  priceHistoryDistinctDays: 5,
  feedTotal: 80,
  feedErrored: 3,
};

// 1. Zdravý stav → ok, žiadne dôvody
{
  const h = evaluatePipelineHealth(healthy);
  assert.equal(h.status, "ok");
  assert.equal(h.reasons.length, 0);
}

// 2. Import pred 31h → critical (denný import nebežal)
{
  const h = evaluatePipelineHealth({ ...healthy, importAgeHours: 31 });
  assert.equal(h.status, "critical");
  assert.ok(h.reasons.some((r) => r.includes("import_freshness")));
}

// 3. Import pred 27h → warn (nie critical)
{
  const h = evaluatePipelineHealth({ ...healthy, importAgeHours: 27 });
  assert.equal(h.status, "warn");
}

// 4. Výpadok produktov → critical
{
  const h = evaluatePipelineHealth({ ...healthy, productTotal: 100 });
  assert.equal(h.status, "critical");
  assert.ok(h.reasons.some((r) => r.includes("products")));
}

// 5. Cenová história pred 3 dňami → critical (nehromadí sa)
{
  const h = evaluatePipelineHealth({ ...healthy, priceHistoryLatestDayAgeDays: 3 });
  assert.equal(h.status, "critical");
  assert.ok(h.reasons.some((r) => r.includes("price_history_growth")));
}

// 6. Cenová história pred 1 dňom → warn (dnes ešte bez snapshotu je bežné)
{
  const h = evaluatePipelineHealth({ ...healthy, priceHistoryLatestDayAgeDays: 1 });
  assert.equal(h.status, "warn");
}

// 7. Prázdna história → warn (nie critical — bootstrapping stav)
{
  const h = evaluatePipelineHealth({ ...healthy, priceHistoryLatestDayAgeDays: null, priceHistoryDistinctDays: 0 });
  assert.equal(h.status, "warn");
}

// 8. Neznámy čas importu (žiadne produkty) → critical
{
  const h = evaluatePipelineHealth({ ...healthy, importAgeHours: null });
  assert.equal(h.status, "critical");
}

// 9. Väčšina feedov chybuje → warn
{
  const h = evaluatePipelineHealth({ ...healthy, feedTotal: 80, feedErrored: 50 });
  assert.equal(h.status, "warn");
  assert.ok(h.reasons.some((r) => r.includes("feed_errors")));
}

// 10. Celkový status = najhorší: warn feedy + critical import → critical
{
  const h = evaluatePipelineHealth({ ...healthy, feedErrored: 50, importAgeHours: 40 });
  assert.equal(h.status, "critical");
}

// 11. Každý check má status a detail; počet checkov = 4
{
  const h = evaluatePipelineHealth(healthy);
  assert.equal(h.checks.length, 4);
  for (const c of h.checks) {
    assert.ok(typeof c.name === "string" && c.name.length > 0);
    assert.ok(["ok", "warn", "critical"].includes(c.status));
    assert.ok(typeof c.detail === "string");
  }
}

console.log("Pipeline health tests passed.");
