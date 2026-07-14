/**
 * Testy vyhodnotenia sledovania ceny (§16 — čistá logika evaluateWatch).
 * Spustenie: npx tsx scripts/test-price-watch.ts
 */
import assert from "node:assert/strict";
import { evaluateWatch, type PriceWatch } from "../lib/heureka/price-watch.ts";

const base: PriceWatch = {
  targetPrice: null,
  targetDropPct: null,
  basePrice: null,
  currency: "EUR",
  lastNotifiedPrice: null,
};

// 1. cieľová cena dosiahnutá (current <= target) → spustí sa
{
  const r = evaluateWatch({ ...base, targetPrice: 50 }, 49.99, "EUR");
  assert.equal(r.triggered, true);
  assert.equal(r.reason, "target_price");
}
// 2. cieľová cena nedosiahnutá → nespustí sa
{
  const r = evaluateWatch({ ...base, targetPrice: 50 }, 55, "EUR");
  assert.equal(r.triggered, false);
}
// 3. percentuálny pokles dosiahnutý (base 100 → 80 = 20 %) → spustí sa
{
  const r = evaluateWatch({ ...base, targetDropPct: 20, basePrice: 100 }, 80, "EUR");
  assert.equal(r.triggered, true);
  assert.equal(r.reason, "target_drop");
}
// 4. percentuálny pokles nedosiahnutý (len 10 %) → nespustí sa
{
  const r = evaluateWatch({ ...base, targetDropPct: 20, basePrice: 100 }, 90, "EUR");
  assert.equal(r.triggered, false);
}
// 5. §9: iná mena → nespustí sa
{
  const r = evaluateWatch({ ...base, targetPrice: 50, currency: "EUR" }, 40, "CZK");
  assert.equal(r.triggered, false);
}
// 6. dedup: už upozornené pri rovnakej/vyššej cene → nespustí sa znovu
{
  const r = evaluateWatch({ ...base, targetPrice: 50, lastNotifiedPrice: 45 }, 48, "EUR");
  assert.equal(r.triggered, false);
}
// 7. dedup: ďalší pokles pod lastNotifiedPrice → spustí sa znovu
{
  const r = evaluateWatch({ ...base, targetPrice: 50, lastNotifiedPrice: 45 }, 42, "EUR");
  assert.equal(r.triggered, true);
}
// 8. nekladná cena → nespustí sa
{
  const r = evaluateWatch({ ...base, targetPrice: 50 }, 0, "EUR");
  assert.equal(r.triggered, false);
}
// 9. obe podmienky → prednosť cieľová cena
{
  const r = evaluateWatch({ ...base, targetPrice: 50, targetDropPct: 20, basePrice: 100 }, 45, "EUR");
  assert.equal(r.triggered, true);
  assert.equal(r.reason, "target_price");
}
// 10. percentuálny pokles bez base_price → nespustí sa
{
  const r = evaluateWatch({ ...base, targetDropPct: 20, basePrice: null }, 10, "EUR");
  assert.equal(r.triggered, false);
}
// 11. presne cieľová cena (hranica) → spustí sa
{
  const r = evaluateWatch({ ...base, targetPrice: 50 }, 50, "EUR");
  assert.equal(r.triggered, true);
}

console.log("Price watch tests passed.");
