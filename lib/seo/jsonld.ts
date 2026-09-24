/**
 * Schema.org JSON-LD — buildery + validácia.
 *
 * Zásady:
 *  - Structured data musí zodpovedať tomu, čo používateľ vidí na stránke.
 *  - Žiadne Product/Offer/AggregateRating (nie sme produktový katalóg, nemáme
 *    overené ceny ani hodnotenia) — validátor ich hlási ako chybu.
 *  - Nevalidný uzol sa pri renderi vyhodí (radšej nič než chybné dáta)
 *    a rovnaký validátor používa SEO audit na hotovom HTML.
 */
import { SITE_NAME, SITE_URL, absoluteUrl } from "./config";

export type JsonLdNode = Record<string, unknown>;

export interface Crumb {
  name: string;
  /** Relatívna alebo absolútna cesta; posledná položka (aktuálna stránka) ju mať nemusí. */
  path?: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: absoluteUrl(c.path) } : {}),
    })),
  };
}

export function itemListJsonLd(name: string, items: { name: string; path: string }[]): JsonLdNode | null {
  if (items.length === 0) return null;
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  };
}

export function websiteJsonLd(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Zlavickovo.sk",
    url: SITE_URL,
    inLanguage: "sk-SK",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function organizationJsonLd(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
  };
}

// ─── Validácia ──────────────────────────────────────────────────────────────

const ABS_URL = /^https:\/\/[^\s]+$/;
const FORBIDDEN_TYPES = new Set(["Product", "Offer", "AggregateOffer", "AggregateRating", "Review"]);

function isIsoDate(v: unknown): boolean {
  return typeof v === "string" && v.length >= 10 && !Number.isNaN(Date.parse(v));
}

function nonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Vráti zoznam chýb pre jeden uzol (bez @graph). Prázdne pole = OK. */
export function validateJsonLdNode(node: JsonLdNode): string[] {
  const errors: string[] = [];
  const type = String(node["@type"] ?? "");
  if (!type) return ["chýba @type"];
  if (FORBIDDEN_TYPES.has(type)) errors.push(`${type}: nepovolený typ (nemáme overené produktové/cenové dáta)`);

  switch (type) {
    case "BreadcrumbList": {
      const items = node.itemListElement as JsonLdNode[] | undefined;
      if (!Array.isArray(items) || items.length === 0) { errors.push("BreadcrumbList: prázdny itemListElement"); break; }
      items.forEach((it, i) => {
        if (it.position !== i + 1) errors.push(`BreadcrumbList: position ${String(it.position)} ≠ ${i + 1}`);
        if (!nonEmpty(it.name)) errors.push(`BreadcrumbList: položka ${i + 1} bez name`);
        const isLast = i === items.length - 1;
        if (!isLast && !ABS_URL.test(String(it.item ?? ""))) errors.push(`BreadcrumbList: položka ${i + 1} bez absolútneho item URL`);
        if (it.item !== undefined && !ABS_URL.test(String(it.item))) errors.push(`BreadcrumbList: neplatné item URL "${String(it.item)}"`);
      });
      break;
    }
    case "ItemList": {
      const items = node.itemListElement as JsonLdNode[] | undefined;
      if (!Array.isArray(items) || items.length === 0) { errors.push("ItemList: prázdny itemListElement"); break; }
      items.forEach((it, i) => {
        const url = it.url ?? (it.item as JsonLdNode | undefined)?.url ?? it.item;
        if (typeof url !== "string" || !ABS_URL.test(url)) errors.push(`ItemList: položka ${i + 1} bez absolútneho URL`);
        if (!nonEmpty(it.name) && typeof it.item !== "object") errors.push(`ItemList: položka ${i + 1} bez name`);
      });
      if (typeof node.numberOfItems === "number" && node.numberOfItems !== items.length) {
        errors.push(`ItemList: numberOfItems ${node.numberOfItems} ≠ ${items.length}`);
      }
      break;
    }
    case "Article":
    case "NewsArticle":
    case "BlogPosting": {
      if (!nonEmpty(node.headline)) errors.push(`${type}: chýba headline`);
      else if (String(node.headline).length > 110) errors.push(`${type}: headline > 110 znakov`);
      if (!isIsoDate(node.datePublished)) errors.push(`${type}: neplatný datePublished`);
      if (node.dateModified !== undefined && !isIsoDate(node.dateModified)) errors.push(`${type}: neplatný dateModified`);
      if (!node.image) errors.push(`${type}: chýba image`);
      break;
    }
    case "WebSite":
    case "Organization": {
      if (!nonEmpty(node.name)) errors.push(`${type}: chýba name`);
      if (!ABS_URL.test(String(node.url ?? ""))) errors.push(`${type}: chýba absolútne url`);
      break;
    }
    case "FAQPage": {
      const qs = node.mainEntity as JsonLdNode[] | undefined;
      if (!Array.isArray(qs) || qs.length === 0) errors.push("FAQPage: prázdny mainEntity");
      else qs.forEach((q, i) => {
        const ans = q.acceptedAnswer as JsonLdNode | undefined;
        if (!nonEmpty(q.name) || !nonEmpty(ans?.text)) errors.push(`FAQPage: otázka ${i + 1} neúplná`);
      });
      break;
    }
    default:
      break;
  }
  return errors;
}

/** Rozbalí @graph a validuje všetky uzly. */
export function validateJsonLd(doc: unknown): { types: string[]; errors: string[] } {
  const nodes: JsonLdNode[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === "object") {
      const o = v as JsonLdNode;
      if (Array.isArray(o["@graph"])) (o["@graph"] as unknown[]).forEach(push);
      else nodes.push(o);
    }
  };
  push(doc);
  const types: string[] = [];
  const errors: string[] = [];
  for (const n of nodes) {
    types.push(String(n["@type"] ?? "?"));
    errors.push(...validateJsonLdNode(n));
  }
  return { types, errors };
}

/**
 * Zostaví finálny JSON-LD dokument: vyhodí null a nevalidné uzly
 * (chybu zaloguje — zachytí ju aj SEO audit, lebo uzol na stránke chýba).
 */
export function buildJsonLdGraph(nodes: (JsonLdNode | null | undefined | false)[]): string | null {
  const valid: JsonLdNode[] = [];
  for (const n of nodes) {
    if (!n) continue;
    const errs = validateJsonLdNode(n);
    if (errs.length) {
      console.warn(`[jsonld] vyradený uzol ${String(n["@type"])}: ${errs.join("; ")}`);
      continue;
    }
    valid.push(n);
  }
  if (valid.length === 0) return null;
  return JSON.stringify({ "@context": "https://schema.org", "@graph": valid }).replace(/</g, "\\u003c");
}
