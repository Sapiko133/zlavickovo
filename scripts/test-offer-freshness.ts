import assert from "node:assert/strict";
import { evaluateFreshness, isOfferActive } from "../lib/offers/freshness.ts";

const NOON_AUG = Date.parse("2026-08-27T10:00:00Z"); // 12:00 Bratislava (CEST)

// Chýbajúca expirácia => aktívna, ale bez claimu o konci platnosti.
{
  const f = evaluateFreshness({ expiresAt: null }, NOON_AUG);
  assert.equal(f.status, "active_no_expiry");
  assert.equal(f.expiresAt, null);
  assert.equal(isOfferActive({ expiresAt: null }, NOON_AUG), true);
}

// ISO budúci / minulý dátum.
assert.equal(evaluateFreshness({ expiresAt: "2026-12-31" }, NOON_AUG).status, "active");
assert.equal(evaluateFreshness({ expiresAt: "2026-01-01" }, NOON_AUG).status, "expired");

// SK/CZ formát DD.MM.YYYY MUSÍ fungovať (inak by sa akcie mylne skryli/nechali).
assert.equal(evaluateFreshness({ expiresAt: "31.12.2026" }, NOON_AUG).status, "active");
assert.equal(evaluateFreshness({ expiresAt: "1. 1. 2026" }, NOON_AUG).status, "expired");

// Neparsovateľná hodnota => "unknown", NIE aktívna (kľúčová oprava dôvery).
for (const bad of ["neomedzená", "čoskoro", "45.13.2026", "kým zásoby stačia"]) {
  assert.equal(evaluateFreshness({ expiresAt: bad }, NOON_AUG).status, "unknown", `"${bad}" má byť unknown`);
  assert.equal(isOfferActive({ expiresAt: bad }, NOON_AUG), false, `"${bad}" nesmie byť aktívna`);
}

// Ešte nezačaté (starts_at v budúcnosti) sa nezobrazí medzi aktívnymi.
{
  const input = { startsAt: "2026-09-01", expiresAt: "2026-12-31" };
  assert.equal(evaluateFreshness(input, NOON_AUG).status, "not_started");
  assert.equal(isOfferActive(input, NOON_AUG), false);
}

// Hranica dňa v LETE (CEST, UTC+2): platnosť "do 2026-08-27" platí celý deň.
assert.equal(evaluateFreshness({ expiresAt: "2026-08-27" }, Date.parse("2026-08-27T21:00:00Z")).status, "active");
assert.equal(evaluateFreshness({ expiresAt: "2026-08-27" }, Date.parse("2026-08-27T22:00:00Z")).status, "expired");

// Hranica dňa v ZIME (CET, UTC+1) — DST-správnosť.
assert.equal(evaluateFreshness({ expiresAt: "2026-01-15" }, Date.parse("2026-01-15T22:30:00Z")).status, "active");
assert.equal(evaluateFreshness({ expiresAt: "2026-01-15" }, Date.parse("2026-01-15T23:30:00Z")).status, "expired");

// Confidence: reálny nedávny verified event zvyšuje skóre, žiadny údaj ho nevymýšľa.
{
  const withVerify = evaluateFreshness(
    { expiresAt: "2026-12-31", lastVerifiedAt: "2026-08-25" },
    NOON_AUG,
  );
  const bare = evaluateFreshness({ expiresAt: "2026-12-31" }, NOON_AUG);
  assert.ok(withVerify.confidence > bare.confidence, "verified event má zvýšiť confidence");
  assert.ok(bare.confidence <= 0.8 && bare.confidence >= 0.5);
}

// String shortcut (spätná kompatibilita s notExpired/isActive volaniami).
assert.equal(isOfferActive("2026-12-31", NOON_AUG), true);
assert.equal(isOfferActive("2000-01-01", NOON_AUG), false);
assert.equal(isOfferActive(null, NOON_AUG), true);

console.log("Offer freshness tests passed.");
