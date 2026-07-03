import * as fs from "fs";
import * as path from "path";

async function main() {
  // Load .env.local for local development (must be before any lib imports)
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    // CRLF-safe split — s "\n" by riadky končili "\r" a regex s $ by nič nematchol
    fs.readFileSync(envPath, "utf-8")
      .split(/\r?\n/)
      .forEach(line => {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) {
          const key = m[1];
          const val = m[2].replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      });
  }

  // Dynamic imports AFTER env loading so Redis/API clients pick up the env vars
  const { getShops, getCoupons } = await import("../lib/dognet");
  const { getEhubShops } = await import("../lib/ehub");

  console.log("[prebuild] Generujem statické dáta...");

  const dataDir = path.join(process.cwd(), "public", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const [shops, coupons, ehubShops] = await Promise.all([
    getShops().catch((e: any) => { console.warn("[prebuild] getShops:", e?.message); return []; }),
    getCoupons().catch((e: any) => { console.warn("[prebuild] getCoupons:", e?.message); return []; }),
    getEhubShops().catch((e: any) => { console.warn("[prebuild] getEhubShops:", e?.message); return []; }),
  ]);

  const sales = (coupons as any[]).filter((c: any) => c.type === 3 || c.type === 1);
  const feed = (coupons as any[]).slice(0, 12);

  const write = (name: string, data: any[]) => {
    fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data));
    console.log(`[prebuild] ✅ ${name}: ${data.length} záznamov`);
  };

  write("shops.json", shops as any[]);
  write("coupons.json", coupons as any[]);
  write("ehub-shops.json", ehubShops as any[]);
  write("sales.json", sales);
  write("feed.json", feed);

  console.log("[prebuild] ✅ Hotovo");
  process.exit(0);
}

main().catch(e => {
  console.error("[prebuild] ❌ Zlyhalo:", e?.message ?? String(e));
  process.exit(0); // non-fatal — build pokračuje
});
