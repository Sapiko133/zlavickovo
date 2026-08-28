import assert from "node:assert/strict";
import { expiryLabel, evidenceClaims } from "../lib/offers/evidence-labels.ts";

const NOW = Date.parse("2026-08-27T10:00:00Z");

// Žiadny countdown bez dátumu (active_no_expiry aj unknown => null).
assert.equal(expiryLabel({ expiresAt: null }, NOW), null);
assert.equal(expiryLabel({ expiresAt: "neomedzená" }, NOW), null);

// Vzdialená platnosť => "Platí do", nie urgentné.
{
  const l = expiryLabel({ expiresAt: "2026-12-31" }, NOW);
  assert.ok(l && !l.urgent && l.text.startsWith("Platí do"));
}

// Blízka platnosť (<=3 dni) => urgentné "Končí".
{
  const l = expiryLabel({ expiresAt: "2026-08-29" }, NOW);
  assert.ok(l && l.urgent && l.text.startsWith("Končí"));
}

// Expirované a not_started.
assert.equal(expiryLabel({ expiresAt: "2026-01-01" }, NOW)?.status, "expired");
assert.equal(expiryLabel({ startsAt: "2026-09-10", expiresAt: "2026-12-31" }, NOW)?.text.startsWith("Od"), true);

// Reálny pokls sa zobrazí len s históriou.
assert.equal(evidenceClaims({ observedDropPct: 30, historyDays: 2 }).length, 0);
{
  const claims = evidenceClaims({ observedDropPct: 30, historyDays: 14 });
  assert.equal(claims[0].kind, "observed-drop");
  assert.equal(claims[0].tone, "saving");
}

// Historické minimum len s históriou.
assert.equal(evidenceClaims({ atHistoricalLow: true, historyDays: 3 }).length, 0);
assert.ok(evidenceClaims({ atHistoricalLow: true, historyDays: 10 }).some((c) => c.kind === "historical-low"));

// Deklarovaná zľava sa NEzdvojuje s pozorovaným poklesom a je označená "Zľava".
{
  const both = evidenceClaims({ observedDropPct: 25, merchantDiscountPct: 40, historyDays: 14 });
  assert.equal(both.some((c) => c.kind === "merchant-discount"), false, "pozorovaný pokls potlačí deklarovanú zľavu");
  const declaredOnly = evidenceClaims({ merchantDiscountPct: 40, historyDays: 0 });
  assert.equal(declaredOnly[0].kind, "merchant-discount");
  assert.equal(declaredOnly[0].tone, "declared");
  assert.ok(declaredOnly[0].label.includes("Zľava"));
}

// Kupón príznak.
assert.ok(evidenceClaims({ hasCoupon: true }).some((c) => c.kind === "coupon"));

console.log("Evidence labels tests passed.");
