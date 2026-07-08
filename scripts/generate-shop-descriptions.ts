/**
 * Generátor SEO popisov obchodov → tabuľka shop_descriptions.
 *
 * Pre každý známy obchod pozbiera overiteľné fakty (názov, kategória, doména,
 * počet kupónov, vzorka produktov z hk_products) a nechá AI (Claude) vygenerovať
 * SHORT (~100–150 slov) a LONG (~300–600 slov) popis. Popisy sú SEO optimalizované,
 * unikátne a bez marketingových klamstiev — zakázané frázy sa tvrdo post-filtrujú.
 *
 * Spustenie:
 *   npx tsx scripts/generate-shop-descriptions.ts                 # všetky, preskoč čerstvé (<30 dní)
 *   npx tsx scripts/generate-shop-descriptions.ts --only=gymbeam  # jeden obchod
 *   npx tsx scripts/generate-shop-descriptions.ts --force         # prepíš aj čerstvé
 *   npx tsx scripts/generate-shop-descriptions.ts --dry-run       # nič nezapisuj, len vypíš
 *   npx tsx scripts/generate-shop-descriptions.ts --limit=20      # max 20 obchodov
 *
 * Env: DATABASE_URL, ANTHROPIC_API_KEY (+ voliteľne SHOP_DESC_MODEL, redis pre all-shops).
 */
import fs from "fs";
import path from "path";

// .env.local — splitovať /\r?\n/ (CRLF na Windows)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MODEL = process.env.SHOP_DESC_MODEL || "claude-haiku-4-5-20251001";
const FRESH_DAYS = 30;

// Zakázané tvrdenia, ktoré nevieme overiť (case-insensitive, bez diakritiky).
const BANNED = [
  "najlepsi", "najlacnejsi", "najvyhodnejsi", "oficialny partner",
  "garantovane ceny", "garantujeme", "100% original", "cislo 1", "c. 1",
];
const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function bannedHit(text: string): string | null {
  const t = deaccent(text);
  for (const b of BANNED) if (t.includes(b)) return b;
  return null;
}

interface Args { only?: string; force: boolean; dryRun: boolean; limit?: number; }
function parseArgs(): Args {
  const a: Args = { force: false, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--force") a.force = true;
    else if (arg === "--dry-run") a.dryRun = true;
    else if (arg.startsWith("--only=")) a.only = arg.slice(7).toLowerCase();
    else if (arg.startsWith("--limit=")) a.limit = parseInt(arg.slice(8), 10) || undefined;
  }
  return a;
}

interface ShopFacts {
  name: string;
  slug: string;
  domain: string;
  category: string;
  couponCount: number;
  productSample: string[];
}

interface GenResult { short: string; long: string; }

async function callClaude(facts: ShopFacts): Promise<GenResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY chýba");

  const factLines = [
    `Názov obchodu: ${facts.name}`,
    facts.domain ? `Doména: ${facts.domain}` : "",
    facts.category ? `Kategória: ${facts.category}` : "",
    facts.couponCount > 0 ? `Aktuálny počet kupónov/akcií u nás: ${facts.couponCount}` : "",
    facts.productSample.length ? `Vzorka reálnych produktov: ${facts.productSample.slice(0, 8).join("; ")}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Si SEO copywriter pre slovenský kupónový portál Zlavickovo.sk. Napíš popis obchodu.

FAKTY (používaj LEN tieto, nič si nevymýšľaj):
${factLines}

PRAVIDLÁ:
- Píš po slovensky, prirodzene, pre bežného nakupujúceho.
- ŽIADNE konkrétne ceny, percentá zliav ani skladovosť (menia sa).
- ZAKÁZANÉ tvrdenia: „najlepší", „najlacnejší", „oficiálny partner", „garantované ceny", „číslo 1".
- Nevymýšľaj históriu firmy, počty zákazníkov ani ocenenia, ak nie sú medzi faktami.
- Ak nemáš dosť faktov, píš všeobecnejšie o kategórii — nikdy nehalucinuj detaily.

VÝSTUP presne ako JSON (bez markdownu):
{"short": "...", "long": "..."}
- "short": 100–150 slov, jeden odsek, zhrnutie čo obchod predáva a prečo tam nakupovať.
- "long": 300–600 slov, 2–4 odseky oddelené prázdnym riadkom, detailnejší popis sortimentu, pre koho je vhodný a ako ušetriť cez kupóny na Zlavickovo.sk.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const text: string = data.content?.[0]?.text?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const short = String(parsed.short ?? "").trim();
    const long = String(parsed.long ?? "").trim();
    if (short.length < 50 || long.length < 150) return null;
    return { short, long };
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const { getDb } = await import("../lib/db");
  const { getAllKnownShops, getStaticKnownShops } = await import("../lib/all-shops");
  const { getProductsByDomain } = await import("../lib/heureka/query");
  const sql = getDb();

  let shops = await getAllKnownShops().catch(() => getStaticKnownShops());
  if (args.only) shops = shops.filter(s => s.slug === args.only);
  if (!shops.length) { console.log("Žiadne obchody na spracovanie."); return; }

  // Čerstvé záznamy (< FRESH_DAYS) preskoč, ak nie je --force
  const freshSlugs = new Set<string>();
  if (!args.force) {
    try {
      const rows = (await sql`
        SELECT slug FROM shop_descriptions
        WHERE updated_at >= now() - (${FRESH_DAYS} || ' days')::interval
      `) as { slug: string }[];
      for (const r of rows) freshSlugs.add(r.slug);
    } catch (e) {
      console.warn("Nepodarilo sa načítať čerstvé záznamy (tabuľka existuje?):", (e as Error).message);
    }
  }

  let processed = 0, written = 0, skipped = 0, failed = 0;
  for (const shop of shops) {
    if (args.limit && processed >= args.limit) break;
    if (freshSlugs.has(shop.slug)) { skipped++; continue; }
    processed++;

    const products = await getProductsByDomain(shop.domain, 8).catch(() => []);
    const facts: ShopFacts = {
      name: shop.name,
      slug: shop.slug,
      domain: shop.domain,
      category: shop.category,
      couponCount: shop.count ?? 0,
      productSample: products.map(p => p.name).filter(Boolean),
    };

    let result: GenResult | null = null;
    let attempt = 0;
    while (attempt < 2 && !result) {
      attempt++;
      try {
        const r = await callClaude(facts);
        if (!r) continue;
        const hit = bannedHit(r.short) || bannedHit(r.long);
        if (hit) { console.warn(`  ⚠ ${shop.slug}: zakázaná fráza „${hit}" (pokus ${attempt}) — retry`); continue; }
        result = r;
      } catch (e) {
        console.warn(`  ⚠ ${shop.slug}: ${(e as Error).message} (pokus ${attempt})`);
      }
    }

    if (!result) { failed++; console.log(`✗ ${shop.slug} — preskočené (bez validného výstupu)`); continue; }

    if (args.dryRun) {
      console.log(`\n=== ${shop.name} (${shop.slug}) ===`);
      console.log("SHORT:", result.short);
      console.log("LONG:", result.long.slice(0, 300) + "…");
      written++;
      continue;
    }

    await sql`
      INSERT INTO shop_descriptions (slug, shop_name, short_description, long_description, category, source, ai_generated, model, generated_at, updated_at)
      VALUES (${shop.slug}, ${shop.name}, ${result.short}, ${result.long}, ${shop.category}, 'ai', true, ${MODEL}, now(), now())
      ON CONFLICT (slug) DO UPDATE SET
        shop_name         = EXCLUDED.shop_name,
        short_description = EXCLUDED.short_description,
        long_description  = EXCLUDED.long_description,
        category          = EXCLUDED.category,
        source            = 'ai',
        ai_generated      = true,
        model             = EXCLUDED.model,
        updated_at        = now()
    `;
    written++;
    console.log(`✓ ${shop.slug} (${result.short.split(/\s+/).length} / ${result.long.split(/\s+/).length} slov)`);
  }

  console.log(`\nHotovo — spracované: ${processed}, zapísané: ${written}, preskočené (čerstvé): ${skipped}, zlyhané: ${failed}${args.dryRun ? " (dry-run)" : ""}`);
}

main().catch(e => { console.error(e); process.exit(1); });
