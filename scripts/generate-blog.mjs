import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Read API key from .env.local
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const API_KEY = env.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) { console.error("ANTHROPIC_API_KEY not found"); process.exit(1); }

const OUT_DIR = path.join(root, "content", "blog");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ARTICLES = [
  { slug: "ako-usettrit-na-alza-10-tipov",       title: "Ako ušetriť na Alza - 10 tipov 2026",              shop: "alza",       category: "tipy" },
  { slug: "shein-zlavove-kody-novi-zakaznici",    title: "Shein zľavové kódy pre nových zákazníkov 2026",    shop: "shein",      category: "kupony" },
  { slug: "booking-com-najlacnejsi-hotel",        title: "Booking.com - ako nájsť najlacnejší hotel",        shop: "booking",    category: "tipy" },
  { slug: "lidl-vs-kaufland-kde-lacnejsie",       title: "Lidl vs Kaufland - kde je lacnejšie?",             shop: "",           category: "porovnanie" },
  { slug: "co-je-cashback-ako-funguje",           title: "Čo je cashback a ako funguje?",                    shop: "",           category: "navody" },
  { slug: "zalando-nakupovat-lacnejsie",          title: "Ako nakupovať na Zalando lacnejšie",               shop: "zalando",    category: "tipy" },
  { slug: "gymbeam-najlepsie-akcie-proteiny",     title: "GymBeam - najlepšie akcie na proteíny",            shop: "gymbeam",    category: "kupony" },
  { slug: "notino-kupony-kozmetika",              title: "Notino kupóny - ako ušetriť na kozmetike",         shop: "notino",     category: "kupony" },
  { slug: "top-5-sposobov-usettrit-online",       title: "Top 5 spôsobov ako ušetriť pri online nakupovaní", shop: "",           category: "tipy" },
  { slug: "ikea-akcie-kedy-nakupovat",            title: "IKEA akcie - kedy nakupovať najlacnejšie",         shop: "ikea",       category: "tipy" },
  { slug: "shein-vs-zalando-ktory-lacnejsi",      title: "Shein vs Zalando - ktorý je lacnejší?",            shop: "",           category: "porovnanie" },
  { slug: "ako-pouzivat-zlavove-kody-spravne",    title: "Ako používať zľavové kódy správne",               shop: "",           category: "navody" },
  { slug: "sportisimo-kupony-sportove-vybavenie", title: "Sportisimo kupóny - ušetri na športovom vybavení", shop: "sportisimo", category: "kupony" },
  { slug: "dedoles-originalne-ponozky-zlava",     title: "Dedoles - originálne ponožky so zľavou",           shop: "dedoles",    category: "kupony" },
  { slug: "martinus-kupony-knihy-lacnejsie",      title: "Martinus kupóny - knihy lacnejšie",               shop: "martinus",   category: "kupony" },
  { slug: "nordvpn-zlava-usettrit-vpn",           title: "NordVPN zľava - ako ušetriť na VPN",              shop: "nordvpn",    category: "tipy" },
  { slug: "najlacnejsie-letenky-ako-najst",       title: "Ako nájsť najlacnejšie letenky",                   shop: "",           category: "tipy" },
  { slug: "websupport-akcie-lacny-webhosting",    title: "Websupport akcie - lacný webhosting",              shop: "websupport", category: "kupony" },
  { slug: "about-you-moda-so-zlavu",              title: "About You móda so zľavou",                         shop: "about-you",  category: "kupony" },
  { slug: "dr-max-lekarnen-akcie-zlavy",          title: "Dr. Max lekáreň - akcie a zľavy",                  shop: "dr-max",     category: "kupony" },
];

const today = new Date().toISOString().split("T")[0];

async function generateArticle(article) {
  const outPath = path.join(OUT_DIR, `${article.slug}.json`);
  if (fs.existsSync(outPath)) {
    console.log(`✓ skip (exists): ${article.slug}`);
    return;
  }

  const prompt = `Napíš blogový článok pre slovenský kupónový portál Zlavickovo.sk.

Téma: "${article.title}"
Minimálne 450 slov. Použi H2 a H3 nadpisy (ako HTML tagy). Zahrň zoznam tipov (ako <ul><li>). Obsah musí byť praktický a užitočný pre slovenského čitateľa.

DÔLEŽITÉ: Vráť VÝLUČNE platný JSON v tomto formáte (bez akéhokoľvek iného textu):
{
  "slug": "${article.slug}",
  "title": "${article.title}",
  "description": "popis článku do 160 znakov",
  "date": "${today}",
  "category": "${article.category}",
  "shop": "${article.shop}",
  "content": "celý HTML obsah článku ako jeden string, s h2, h3, p, ul, li tagmi"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    console.error(`✗ ${article.slug}: ${data.error?.message || res.status}`);
    return;
  }

  const text = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`✗ ${article.slug}: no JSON in response`);
    return;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
    console.log(`✓ generated: ${article.slug}`);
  } catch (e) {
    console.error(`✗ ${article.slug}: JSON parse error`);
  }
}

// Run in batches of 5 to avoid rate limits
async function run() {
  const BATCH = 5;
  for (let i = 0; i < ARTICLES.length; i += BATCH) {
    const batch = ARTICLES.slice(i, i + BATCH);
    console.log(`\nBatch ${Math.floor(i/BATCH)+1}: generating ${batch.map(a => a.slug).join(", ")}`);
    await Promise.all(batch.map(generateArticle));
  }
  console.log("\nDone.");
}

run().catch(console.error);
