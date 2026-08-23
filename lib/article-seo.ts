import type { Article } from "@/lib/articles";
import type { AffiliateAction } from "@/lib/affiliate-actions";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sentence(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function formatActionValidity(validTo?: string | null): string {
  if (!validTo) return "Ponuka je priebežná a obchod môže jej podmienky zmeniť.";
  const date = new Date(validTo);
  if (Number.isNaN(date.getTime())) return "Presný koniec ponuky si overte priamo v obchode.";
  return `Podľa dostupných údajov platí ponuka do ${date.toLocaleDateString("sk-SK")}.`;
}

export function buildAffiliateActionPerex(action: AffiliateAction): string {
  const detail = sentence(action.description || action.title);
  const validity = formatActionValidity(action.validTo);
  return `${action.shopName}: ${detail} ${validity}`.slice(0, 260);
}

/** Krátky faktický SEO obsah výhradne z údajov konkrétnej akcie a produktového feedu. */
export function buildSaleSeoContent(article: Article): string {
  const shopName = escapeHtml(article.shopName || "obchode");
  const title = escapeHtml(article.title);
  const perex = escapeHtml(sentence(article.perex));
  const validity = escapeHtml(formatActionValidity(article.validTo));
  const products = (article.products || []).filter((product) => product.name).slice(0, 6);
  const productNames = products.map((product) => `<li>${escapeHtml(product.name)}</li>`).join("");
  const productParagraph = products.length > 0
    ? `V aktuálnom výbere sa nachádza ${products.length} zaujímavých produktov z ponuky ${shopName}. Ceny sa môžu meniť, preto ich porovnajte s cenou zobrazenou v košíku.`
    : `Ponuka sa môže vzťahovať na celý sortiment alebo iba na vybrané položky. Presný rozsah akcie a prípadné výnimky nájdete na stránke ${shopName}.`;

  return [
    `<h2>${title}</h2>`,
    `<p>${perex}</p>`,
    `<h2>Čo ponúka aktuálna akcia ${shopName}</h2>`,
    `<p>${escapeHtml(sentence(productParagraph))}</p>`,
    productNames ? `<ul>${productNames}</ul>` : "",
    `<h2>Ako využiť ponuku</h2>`,
    `<p>Po otvorení obchodu skontrolujte označené produkty, minimálnu hodnotu objednávky a ďalšie podmienky. Zľava sa môže započítať automaticky v košíku. Ak obchod vyžaduje kupónový kód, nájdete ho v samostatnej kupónovej sekcii Zlavickovo.</p>`,
    `<h2>Platnosť a dostupnosť</h2>`,
    `<p>${validity} Dostupnosť produktov, výsledná cena a podmienky sa môžu priebežne meniť. Rozhodujúce sú vždy informácie uvedené priamo v obchode pred dokončením objednávky.</p>`,
    `<p>Odkaz do obchodu môže byť partnerský. Cena pre návštevníka sa tým nemení a pomáha financovať aktualizáciu akcií na Zlavickovo.sk.</p>`,
  ].filter(Boolean).join("");
}

export function actionContentHash(action: AffiliateAction): string {
  const input = [
    action.actionKey,
    action.title,
    action.description,
    action.affiliateUrl,
    action.validTo || "",
    action.discountPct ?? "",
  ].join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
