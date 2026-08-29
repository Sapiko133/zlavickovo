/**
 * Test resolvera reálnych obrázkov akcií (žiadna AI grafika).
 * Spustenie: npx tsx scripts/test-action-image.ts
 */
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { resolveActionImage } = await import("../lib/action-image");

  // Konkrétne obchody, o ktorých vieme, že majú Dognet bannery aj og:image.
  const { getAffiliateActions } = await import("../lib/affiliate-actions");
  const actions = await getAffiliateActions().catch(() => []);
  console.log(`Aktuálnych affiliate akcií: ${actions.length}`);

  // Fixné + vzorka reálnych akcií naprieč sieťami (dognet/ehub/cj).
  const fixed = [
    { shopName: "Sizeer.sk", domain: "sizeer.sk" },
    { shopName: "Alza.sk", domain: "alza.sk" },
  ];
  const bySource: Record<string, { shopName: string; domain: string }> = {};
  for (const a of actions) if (!bySource[a.source]) bySource[a.source] = { shopName: a.shopName, domain: a.domain };
  const targets = [...fixed, ...Object.values(bySource), ...actions.slice(0, 8).map((a) => ({ shopName: a.shopName, domain: a.domain }))];

  for (const t of targets) {
    const img = await resolveActionImage(t);
    console.log(
      `\n• ${t.shopName} (${t.domain})\n  → ${img ? `${img.source}: ${img.url}` : "žiadny reálny obrázok → UI dá logo obchodu (favicon)"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
