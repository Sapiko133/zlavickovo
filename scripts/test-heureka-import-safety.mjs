import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const configSource = readFileSync(new URL("../lib/heureka/config.ts", import.meta.url), "utf8");
const importSource = readFileSync(new URL("../lib/heureka/import.ts", import.meta.url), "utf8");

assert.match(
  configSource,
  /HEUREKA_AUDIT_MAX_ITEMS\s*=\s*100/,
  "audit mode must cap one feed sample at 100 items"
);
assert.match(
  configSource,
  /HEUREKA_AUDIT_REQUEST_BUDGET_MS\s*=\s*90\s*\*\s*1000/,
  "audit request budget must be 90 seconds"
);
assert.match(
  configSource,
  /HEUREKA_AUDIT_FEED_TIMEOUT_MS\s*=\s*60\s*\*\s*1000/,
  "audit per-feed timeout must be 60 seconds"
);
assert.match(
  configSource,
  /HEUREKA_FULL_FEED_TIMEOUT_MS\s*=\s*60\s*\*\s*1000/,
  "full mode must keep the shared per-feed timeout guard"
);

assert.match(
  importSource,
  /maxItems:\s*HEUREKA_AUDIT_MAX_ITEMS/,
  "audit mode must use the explicit audit maxItems"
);
assert.match(
  importSource,
  /requestBudgetMs:\s*HEUREKA_AUDIT_REQUEST_BUDGET_MS/,
  "audit mode must use the explicit audit request budget"
);
assert.match(
  importSource,
  /AbortSignal\.timeout\(modeConfig\.feedTimeoutMs\)/,
  "feed download must use the mode-specific hard timeout"
);
assert.match(
  importSource,
  /while \(items < maxItems/,
  "streaming download must stop after the configured sample size"
);
assert.match(
  importSource,
  /truncated:\s*true/,
  "sampled or size-limited feeds must be marked truncated"
);
assert.match(
  importSource,
  /Promise\.allSettled/,
  "a failed feed must not reject the whole batch"
);
assert.match(
  importSource,
  /finally\s*\{\s*await releaseImportLock\(sql, owner\);/s,
  "lock must be released when the request finishes or errors"
);
assert.match(
  importSource,
  /needsNextRequest/,
  "batch result must include structured continuation state"
);

console.log("Heureka import safety static checks passed");
