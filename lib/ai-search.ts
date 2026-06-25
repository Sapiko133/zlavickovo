import { unstable_cache } from "next/cache";

const COUNTRY_LABELS: Record<string, string> = {
  sk: "slovensko", cz: "česko", global: "celý svet",
  de: "Nemecko", uk: "UK", us: "USA", pl: "Poľsko", at: "Rakúsko",
};

async function fetchAiCoupons(shopName: string, country = "sk") {
  const year = new Date().getFullYear();
  const countryLabel = COUNTRY_LABELS[country] || "celý svet";

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
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      tool_choice: { type: "any" },
      system: `Si expert na zľavové kódy a kupóny. Použi web_search na nájdenie aktuálnych zliav.

Hľadaj:
1. Promo kódy zadávané pri pokladni (napr. SUMMER20) – najlepšie
2. Percentuálne zľavy a akcie (napr. "20% na elektroniku") – tiež OK
3. Doprava zadarmo, darčeky k nákupu – tiež OK

Pre typ "promo_code" uveď skutočný kód. Pre typ "deal" uveď "AKCIA" ako code.
Pole "url" musí byť PRIAMY odkaz na stránku obchodu kde je akcia (nie na kupónový web).

Odpovedaj VÝLUČNE týmto JSON (bez iného textu):
{"shop":"nazov","codes":[{"code":"KOD_alebo_AKCIA","discount":"napr 20%","description":"popis zľavy","type":"promo_code alebo deal","url":"priamy odkaz na obchod","valid_until":"DD.MM.YYYY alebo null"}],"note":""}`,
      messages: [{
        role: "user",
        content: `Nájdi zľavové kódy a aktuálne zľavy pre obchod "${shopName}" v ${year}, región: ${countryLabel}. Prehľadaj vouchery.sk, kuponovnik.sk, kuponyzdarma.sk, sleviste.cz a aj priamo web obchodu ${shopName}. Vráť iba JSON.`,
      }],
    }),
  });

  const data = await response.json();

  if (!response.ok || data.type === "error" || data.error) {
    throw new Error(data.error?.message || `Anthropic API error ${response.status}`);
  }

  const allText = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const jsonMatch = allText.match(/\{[\s\S]*"codes"[\s\S]*\}/);
  let result: any = { shop: shopName, codes: [], note: "" };
  if (jsonMatch) {
    try { result = JSON.parse(jsonMatch[0]); } catch (e) {}
  }
  return result;
}

export const getAiCoupons = unstable_cache(
  fetchAiCoupons,
  ["ai-coupons"],
  { revalidate: 86400 },
);
