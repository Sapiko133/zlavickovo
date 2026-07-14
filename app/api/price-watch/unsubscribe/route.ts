import { deactivateWatchByToken } from "@/lib/heureka/price-watch";

export const dynamic = "force-dynamic";

/**
 * Odhlásenie sledovania ceny cez token z upozorňovacieho emailu (§23 jednoduché
 * odhlásenie). Deaktivuje watch (nemaže — history/audit), vráti minimálnu HTML
 * potvrdzujúcu stránku. Token je náhodný UUID, neprezrádza email ani produkt.
 */
function page(title: string, message: string): Response {
  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#1d1d1f;max-width:520px;margin:64px auto;padding:0 20px;text-align:center">
<div style="font-size:40px">🔔</div>
<h1 style="font-size:22px;margin:12px 0">${title}</h1>
<p style="color:#555;line-height:1.5">${message}</p>
<a href="https://www.zlavickovo.sk" style="display:inline-block;margin-top:16px;background:#22C55E;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Späť na Zľavičkovo</a>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const done = await deactivateWatchByToken(token);
    return done
      ? page("Odhlásené", "Sledovanie ceny tohto produktu sme zrušili. Už ti k nemu nepošleme upozornenia.")
      : page("Odkaz je neplatný", "Toto sledovanie už bolo zrušené alebo odkaz nie je platný.");
  } catch {
    return page("Chyba", "Odhlásenie sa nepodarilo spracovať. Skús to prosím neskôr.");
  }
}
