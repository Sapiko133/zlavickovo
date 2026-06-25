export const maxDuration = 60;

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hodín

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product, country = 'sk' } = req.body;
  if (!product) return res.status(400).json({ error: 'Chýba produkt' });

  const cacheKey = `product_${product.toLowerCase()}_${country}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.status(200).json({ ...cached.data, _cached: true });
  }

  const year = new Date().getFullYear();
  const COUNTRY_LABELS = {
    sk: 'slovensko', cz: 'česko', global: 'celý svet',
    de: 'Nemecko', uk: 'UK', us: 'USA', pl: 'Poľsko', at: 'Rakúsko',
  };
  const countryLabel = COUNTRY_LABELS[country] || 'celý svet';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        tool_choice: { type: 'auto' },
        system: `Nájdi obchody kde sa predáva produkt a ich zľavové kódy.
DOLEZITE: pole "code" musi byt PROMO KOD zadavany pri pokladni (napr. SUMMER20). NIE zľava ani popis!
Odpovedaj POUZE týmto JSON bez iného textu:
{"product":"...","results":[{"shop":"...","shop_url":"...","product_url":"...","codes":[{"code":"SKUTOCNY_KOD","discount":"10%","description":"popis","source":"zdroj","valid_until":"DD.MM.YYYY alebo null","added":"DD.MM.YYYY alebo null"}]}],"note":"..."}
Zahrň LEN obchody kde si našiel kód.`,
        messages: [{
          role: 'user',
          content: `Hľadaj produkt "${product}" ${year}, región: ${countryLabel}. Nájdi obchody a zľavové kódy na vouchery.sk, sleviste.cz, kuponovnik.sk, kuponyzdarma.sk, reddit, TikTok, YouTube a celom internete. Vráť iba JSON.`
        }]
      })
    });

    const data = await response.json();
    const allText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const jsonMatch = allText.match(/\{[\s\S]*"results"[\s\S]*\}/);

    let result = { product, results: [], note: 'Nenašli sa kódy.' };
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch(e) {}
    }

    cache.set(cacheKey, { data: result, ts: Date.now() });
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
