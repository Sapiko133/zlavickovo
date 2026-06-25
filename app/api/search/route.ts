import { getCache, setCache } from "@/lib/cache";

const COUNTRY_LABELS: Record<string, string> = {
  sk: "slovensko", cz: "česko", global: "celý svet",
  de: "Nemecko", uk: "UK", us: "USA", pl: "Poľsko", at: "Rakúsko",
};

export async function POST(req: Request) {
  const { shopName, country = "sk" } = await req.json();
  if (!shopName) return Response.json({ error: "Chýba shopName" }, { status: 400 });

  const cacheKey = `shop_${shopName.toLowerCase()}_${country}`;
  const cached = getCache(cacheKey);
  if (cached) return Response.json({ ...cached, _cached: true });

  const year = new Date().getFullYear();
  const countryLabel = COUNTRY_LABELS[country] || "celý svet";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "auto" },
        system: `Nájdi zľavové kódy pre eshop pomocou web_search.
DOLEZITE: pole "code" musi byt PROMO KOD zadavany pri pokladni (napr. SUMMER20, ZIMA15). NIE zľava ani popis!
Odpovedaj POUZE týmto JSON bez iného textu:
{"shop":"nazov","codes":[{"code":"SKUTOCNY_KOD","discount":"10%","description":"popis","source":"zdroj","valid_until":"DD.MM.YYYY alebo null","added":"DD.MM.YYYY alebo null"}],"note":""}`,
        messages: [{
          role: "user",
          content: `Nájdi zľavové kódy pre obchod "${shopName}" v ${year}, región: ${countryLabel}. Hľadaj na vouchery.sk, sleviste.cz, kuponovnik.sk, kuponyzdarma.sk, reddit, TikTok, YouTube a celom internete. Vráť iba JSON.`
        }]
      }),
    });

    const data = await response.json();
    const allText = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    const jsonMatch = allText.match(/\{[\s\S]*"codes"[\s\S]*\}/);
    let result: any = { shop: shopName, codes: [], note: "Nenašli sa kódy." };
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch (e) {}
    }

    setCache(cacheKey, result);
    return Response.json(result);

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}