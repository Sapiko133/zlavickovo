import assert from "node:assert/strict";
import { buildHeurekaSearchUrl, buildHeurekaUrl } from "../lib/heureka/affiliate-url.ts";
import { buildServerHeurekaUrl, getHeurekaHaffId, getProductOutboundUrl } from "../lib/heureka/affiliate.ts";

function countParam(url: string, param: string): number {
  const parsed = new URL(url);
  let count = 0;
  parsed.searchParams.forEach((_, key) => {
    if (key === param) count += 1;
  });
  return count;
}

{
  const url = buildHeurekaSearchUrl("iPhone 16", { affiliateId: "71186" });
  const parsed = new URL(url);

  assert.equal(parsed.hostname, "www.heureka.sk");
  assert.equal(parsed.searchParams.get("h[fraze]"), "iPhone 16");
  assert.equal(parsed.searchParams.get("haff"), "71186");
  assert.equal(countParam(url, "haff"), 1);
  assert.equal(parsed.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(parsed.searchParams.get("utm_medium"), "affiliate");
  assert.equal(parsed.searchParams.has("positionid"), false);
  assert.match(url, /h%5Bfraze%5D=iPhone\+16/);
}

{
  const url = buildHeurekaUrl("https://www.heureka.sk/?foo=bar&positionid=71010&haff=old", {
    affiliateId: "71186",
  });
  const parsed = new URL(url);

  assert.equal(parsed.searchParams.get("foo"), "bar");
  assert.equal(parsed.searchParams.get("haff"), "71186");
  assert.equal(countParam(url, "haff"), 1);
  assert.equal(parsed.searchParams.has("positionid"), false);
}

{
  const url = buildHeurekaSearchUrl("notebook", { affiliateId: undefined });
  const parsed = new URL(url);

  assert.equal(parsed.searchParams.has("haff"), false);
  assert.equal(url.includes("haff=undefined"), false);
  assert.equal(parsed.searchParams.get("utm_medium"), "affiliate");
}

{
  const url = buildHeurekaUrl("https://evil.example/?next=https://www.heureka.sk", {
    affiliateId: "71186",
  });
  const parsed = new URL(url);

  assert.equal(parsed.hostname, "www.heureka.sk");
  assert.equal(parsed.searchParams.get("haff"), "71186");
  assert.equal(parsed.searchParams.has("next"), false);
}

// ── Server helpery (čítajú HEUREKA_HAFF_ID z env) ──

const EXPECTED_HAFF = "71186";

{
  process.env.HEUREKA_HAFF_ID = EXPECTED_HAFF;

  // Vlastný affiliate_url produktu má prioritu — Heureka fallback sa nepoužije
  const own = "https://go.dognet.com/deeplink?url=https%3A%2F%2Fwww.alza.sk%2Fiphone";
  assert.equal(getProductOutboundUrl({ affiliate_url: own, ean: "123", name: "iPhone" }), own);
  assert.equal(getProductOutboundUrl({ affiliateUrl: own, name: "iPhone" }), own);

  // Bez affiliate_url → Heureka vyhľadávanie s haff (EAN má prednosť pred názvom)
  const fallback = new URL(getProductOutboundUrl({ affiliate_url: null, ean: "8588001234567", name: "iPhone 16" }));
  assert.equal(fallback.hostname, "www.heureka.sk");
  assert.equal(fallback.searchParams.get("h[fraze]"), "8588001234567");
  assert.equal(fallback.searchParams.get("haff"), EXPECTED_HAFF);
  assert.equal(fallback.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(fallback.searchParams.get("utm_medium"), "affiliate");
  assert.equal(fallback.searchParams.has("positionid"), false);

  const byName = new URL(getProductOutboundUrl({ affiliate_url: null, ean: "", name: "iPhone 16" }));
  assert.equal(byName.searchParams.get("h[fraze]"), "iPhone 16");
  assert.equal(byName.searchParams.get("haff"), EXPECTED_HAFF);

  const home = new URL(buildServerHeurekaUrl());
  assert.equal(home.hostname, "www.heureka.sk");
  assert.equal(home.searchParams.get("haff"), EXPECTED_HAFF);
  assert.equal(countParam(home.toString(), "haff"), 1);
}

{
  // Chýbajúci HEUREKA_HAFF_ID nesmie spôsobiť pád — odkaz sa vytvorí bez haff
  delete process.env.HEUREKA_HAFF_ID;

  assert.equal(getHeurekaHaffId(), undefined);

  const url = new URL(getProductOutboundUrl({ affiliate_url: null, name: "notebook" }));
  assert.equal(url.hostname, "www.heureka.sk");
  assert.equal(url.searchParams.has("haff"), false);
  assert.equal(url.searchParams.get("utm_source"), "zlavickovo");
  assert.equal(url.searchParams.get("utm_medium"), "affiliate");

  const home = new URL(buildServerHeurekaUrl());
  assert.equal(home.searchParams.has("haff"), false);
}

console.log("Heureka affiliate URL tests passed.");
