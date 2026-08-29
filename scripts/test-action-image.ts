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
  const targets = [
    { shopName: "Sizeer.sk", domain: "sizeer.sk" },
    { shopName: "Tchibo.sk", domain: "tchibo.sk" },
    { shopName: "Alza.sk", domain: "alza.sk" },
    { shopName: "Puravia.cz", domain: "puravia.cz" },
    { shopName: "Piumo.sk", domain: "piumo.sk" },
    { shopName: "Hauzi.sk", domain: "hauzi.sk" },
  ];

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
