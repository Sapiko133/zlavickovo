import assert from "node:assert/strict";
import {
  DAILY_REFRESH_CACHE_TTL_SECONDS,
  DAILY_REFRESH_INTERVAL_SECONDS,
  PROCESS_MEMO_TTL_SECONDS,
} from "../lib/feeds/cache-policy";

assert.equal(DAILY_REFRESH_INTERVAL_SECONDS, 86_400);
assert.equal(DAILY_REFRESH_CACHE_TTL_SECONDS, 129_600);
assert.ok(
  DAILY_REFRESH_CACHE_TTL_SECONDS > DAILY_REFRESH_INTERVAL_SECONDS,
  "Denná cache musí mať rezervu nad 24-hodinový cron interval",
);
assert.ok(
  PROCESS_MEMO_TTL_SECONDS < DAILY_REFRESH_INTERVAL_SECONDS,
  "Procesová memoizácia nesmie nahradiť denný refresh",
);

console.log("Feed cache policy tests passed.");
