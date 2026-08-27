import assert from "node:assert/strict";
import { deriveProviderStatus, evaluateCacheSet } from "../lib/feeds/health.ts";

// Úplná cache s produktmi je zdravá.
assert.equal(evaluateCacheSet({ feedIds: 4, cachedFeeds: 4, count: 1200 }), "ok");

// Set ID existuje, ale všetky produktové kľúče expirovali.
assert.equal(evaluateCacheSet({ feedIds: 4, cachedFeeds: 0, count: 0 }), "missing");

// Čiastočne expirovaná cache sa nesmie vydávať za úspešnú nulu.
assert.equal(evaluateCacheSet({ feedIds: 4, cachedFeeds: 2, count: 600 }), "missing");

// Redis chyba má prednosť pred číslami, ktoré sme stihli prečítať.
assert.equal(evaluateCacheSet({ feedIds: 4, cachedFeeds: 3, count: 600, failedReads: 1 }), "error");

// Skutočne prečítaná, ale prázdna cache je explicitný empty stav.
assert.equal(evaluateCacheSet({ feedIds: 1, cachedFeeds: 1, count: 0 }), "empty");

assert.equal(deriveProviderStatus({ productStatus: "ok", couponStatus: "ok", importStatus: "success" }), "healthy");
assert.equal(deriveProviderStatus({ productStatus: "missing", couponStatus: "ok", importStatus: "success" }), "warning");
assert.equal(deriveProviderStatus({ productStatus: "missing", couponStatus: "missing", importStatus: "success" }), "missing");
assert.equal(deriveProviderStatus({ productStatus: "error", couponStatus: "ok", importStatus: "success" }), "error");
assert.equal(deriveProviderStatus({ productStatus: "unsupported", couponStatus: "ok", importStatus: "success" }), "healthy");
assert.equal(deriveProviderStatus({ productStatus: "unsupported", couponStatus: "unsupported" }), "unsupported");
assert.equal(deriveProviderStatus({ productStatus: "ok", couponStatus: "static", importStatus: "never" }), "warning");

console.log("Feed provider health tests passed.");

