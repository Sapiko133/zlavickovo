import { redis } from "@/lib/redis";
import { getLatestCoupons } from "@/lib/dognet";

export const dynamic = "force-dynamic";

const TOPICS = [
  "Ako ušetriť na online nákupoch",
  "Najlepšie zľavy týždňa",
  "Cashback - nový spôsob šetrenia",
];

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const coupons = await getLatestCoupons(10);
    const shopNames = [...new Set(coupons.map((c: any) => c.campaign?.name).filter(Boolean))];

    const generated: string[] = [];

    for (let i = 0; i < Math.min(3, TOPICS.length); i++) {
      const topic = TOPICS[i];
      const shop = shopNames[i] || "";
      const slug = `auto-${Date.now()}-${i}`;

      const article = {
        slug,
        title: topic,
        description: `Aktuálne tipy a zľavy: ${topic}`,
        date: new Date().toISOString().split("T")[0],
        category: "tipy",
        shop: typeof shop === "string" ? shop.toLowerCase() : "",
        content: `<p>Článok bol automaticky vygenerovaný na základe aktuálnych Dognet kupónov.</p><p>Aktuálne kupóny: ${shopNames.slice(0, 5).join(", ")}</p>`,
      };

      await redis.set(`blog:${slug}`, JSON.stringify(article), { ex: 86400 * 30 });
      generated.push(slug);
    }

    return Response.json({ ok: true, generated });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
