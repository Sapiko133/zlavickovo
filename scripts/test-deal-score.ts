import assert from "node:assert/strict";
import { scoreDeal } from "../lib/deals/score.ts";

// KĽÚČOVÉ: umelá -90 % deklarovaná zľava BEZ histórie nesmie poraziť
// dôveryhodný reálny -30 % pokls s históriou.
{
  const fake = scoreDeal({ merchantDiscountPct: 90, historyDays: 0, freshness: "active", confidence: 1 });
  const real = scoreDeal({ observedDropPct: 30, historyDays: 14, freshness: "active", confidence: 1 });
  assert.ok(real.score > fake.score, `real ${real.score} má poraziť fake ${fake.score}`);
  assert.equal(fake.trustworthy, false, "veľká deklarovaná zľava bez doloženia = nedôveryhodná");
  assert.equal(real.trustworthy, true);
}

// Bez histórie sa NEGENERUJE claim o poklese ani o historickom minime.
{
  const s = scoreDeal({ observedDropPct: 50, atHistoricalLow: true, historyDays: 0, freshness: "active" });
  assert.equal(s.components.observedDrop, 0, "bez histórie žiadny drop claim");
  assert.equal(s.components.historicalLow, 0, "bez histórie žiadne historické minimum");
}

// Historické minimum sa počíta iba s dostatočnou históriou.
assert.equal(scoreDeal({ atHistoricalLow: true, historyDays: 3 }).components.historicalLow, 0);
assert.ok(scoreDeal({ atHistoricalLow: true, historyDays: 10 }).components.historicalLow > 0);

// Expirovaná ponuka sa výrazne potlačí oproti aktívnej s rovnakými dôkazmi.
{
  const active = scoreDeal({ observedDropPct: 40, historyDays: 14, freshness: "active" });
  const expired = scoreDeal({ observedDropPct: 40, historyDays: 14, freshness: "expired" });
  assert.ok(expired.score < active.score * 0.5);
}

// Currency-agnostické: skóre nezávisí od absolútnej ceny (žiadne cenové pole).
// Dva rôzne varianty s rovnakými percentami majú rovnaké skóre => nemieša meny.
{
  const a = scoreDeal({ observedDropPct: 25, historyDays: 14, confidence: 0.9 });
  const b = scoreDeal({ observedDropPct: 25, historyDays: 14, confidence: 0.9 });
  assert.equal(a.score, b.score);
}

// Monetizácia nie je vstup: model nemá affiliate/províziu (kontrola typu je pri builde).
// Determinizmus + rozsah 0..100.
{
  const s = scoreDeal({ observedDropPct: 100, merchantDiscountPct: 100, atHistoricalLow: true, historyDays: 30, popularity: 1, shopQuality: 1, hasCoupon: true, confidence: 1, freshness: "active" });
  assert.ok(s.score <= 100 && s.score > 0);
}

console.log("Deal score tests passed.");
