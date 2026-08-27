import assert from "node:assert/strict";
import { isRefreshableProvider } from "../lib/feeds/FeedManager.ts";

// Refreshovateľní provideri majú import funkciu.
for (const provider of ["dognet", "affial", "ehub", "cj"]) {
  assert.equal(isRefreshableProvider(provider), true, `${provider} má byť refreshovateľný`);
}

// Heureka má samostatný ťažký cron a nesmie sa dať obnoviť cez rýchle admin tlačidlo.
assert.equal(isRefreshableProvider("heureka"), false);

// Neznáme hodnoty sa odmietnu (route vráti 400).
assert.equal(isRefreshableProvider("__proto__"), false);
assert.equal(isRefreshableProvider(""), false);
assert.equal(isRefreshableProvider("all"), false);

console.log("Feed refresh guard tests passed.");
