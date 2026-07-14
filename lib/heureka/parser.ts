import { XMLParser } from "fast-xml-parser";
import { HEUREKA_MAX_ITEMS } from "./config";
import { detectCurrencyFromPriceText, normalizeCurrencyCode, type SupportedCurrency } from "@/lib/price";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
};

function decodeOnce(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const cp = parseInt(h, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const cp = parseInt(d, 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
    })
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (m, n) => NAMED_ENTITIES[n] ?? m);
}

/**
 * Dekóduje HTML entity v texte feedu (názvy sú často dvojito escapované:
 * `&amp;#039;` → po XML parse `&#039;` → tu `'`). Max 2 prechody kvôli
 * dvojitému escapovaniu, bez rizika nekonečného rozbaľovania.
 */
export function decodeEntities(s: string): string {
  if (!s || !s.includes("&")) return s;
  let out = decodeOnce(s);
  if (out.includes("&")) out = decodeOnce(out);
  return out;
}

// Bezpečné čítanie skalárneho poľa — vráti "" ak je hodnota objekt (napr. nested XML)
type XmlRecord = Record<string, unknown>;

function isRecord(value: unknown): value is XmlRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): XmlRecord | undefined {
  if (!isRecord(value)) return undefined;
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function getValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function pickStr(item: XmlRecord, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k];
    if (v == null) continue;
    if (typeof v === "object") return "";
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

export interface ParsedProduct {
  name: string;
  description: string;
  price: string;
  currencyCode: SupportedCurrency | null;
  url: string;
  imgUrl: string;
  category: string;
  ean: string;
  itemId: string;
  manufacturer: string;
  productno: string;
}

export interface ParseHeurekaXmlResult {
  status: "success" | "empty" | "unsupported_format" | "parse_error" | "truncated";
  products: ParsedProduct[];
  parsedCount: number;
  validCount: number;
  skippedCount: number;
  errorMessage?: string;
  truncated: boolean;
}

export interface ParseHeurekaXmlOptions {
  maxItems?: number;
  truncated?: boolean;
}

function parseProducts(items: XmlRecord[], feedCategory: string): ParsedProduct[] {
  return items
    .map((item): ParsedProduct => {
      const rawCategory = String(
        getValue(item, "CATEGORY_FULL") ?? getValue(item, "CATEGORYTEXT") ?? getValue(item, "categorytext") ?? ""
      ).trim();
      const price = String(getValue(item, "PRICE_VAT") ?? getValue(item, "PRICE") ?? getValue(item, "price") ?? "").trim();
      const explicitCurrency =
        pickStr(item, "CURRENCY_CODE", "CURRENCY", "PRICE_CURRENCY", "currency_code", "currency");
      return {
        name: decodeEntities(String(getValue(item, "PRODUCTNAME") ?? getValue(item, "NAME") ?? getValue(item, "productname") ?? getValue(item, "name") ?? "").trim()),
        description: decodeEntities(stripHtml(
          String(getValue(item, "DESCRIPTION") ?? getValue(item, "description") ?? "")
        )).slice(0, 300),
        price,
        currencyCode: normalizeCurrencyCode(explicitCurrency) ?? detectCurrencyFromPriceText(price),
        url: String(getValue(item, "URL") ?? getValue(item, "url") ?? "").trim(),
        imgUrl: String(
          getValue(item, "IMGURL") ?? getValue(item, "IMAGE_MAIN") ?? getValue(item, "IMGURL_ALTERNATIVE") ?? getValue(item, "imgurl") ?? ""
        ).trim(),
        category: rawCategory || feedCategory,
        ean: pickStr(item, "EAN", "ean"),
        itemId: pickStr(item, "ITEM_ID", "item_id"),
        manufacturer: pickStr(item, "MANUFACTURER", "manufacturer"),
        productno: pickStr(item, "PRODUCTNO", "productno", "ISBN", "isbn"),
      };
    })
    .filter((p) => p.name && p.url);
}

export function parseHeurekaXmlDetailed(
  xml: string,
  feedCategory: string,
  options: ParseHeurekaXmlOptions = {}
): ParseHeurekaXmlResult {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    return {
      status: "parse_error",
      products: [],
      parsedCount: 0,
      validCount: 0,
      skippedCount: 0,
      errorMessage: err instanceof Error ? err.message : "XML parse error",
      truncated: Boolean(options.truncated),
    };
  }

  // Heureka štandard: <SHOP><SHOPITEM>...</SHOPITEM></SHOP>
  // Niektoré feedy majú RSS wrapper: <rss><SHOP><SHOPITEM>...
  const shopRoot =
    getRecord(parsed, "SHOP") ??
    getRecord(parsed, "shop") ??
    getRecord(getRecord(parsed, "rss"), "SHOP") ??
    getRecord(getRecord(parsed, "rss"), "shop") ??
    getRecord(getRecord(parsed, "RSS"), "SHOP") ??
    getRecord(getRecord(parsed, "RSS"), "shop") ??
    parsed;
  const rawItems = getValue(shopRoot, "SHOPITEM") ?? getValue(shopRoot, "shopitem");
  if (!rawItems) {
    return {
      status: "unsupported_format",
      products: [],
      parsedCount: 0,
      validCount: 0,
      skippedCount: 0,
      truncated: Boolean(options.truncated),
    };
  }

  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).filter(isRecord);
  const maxItems = options.maxItems ?? items.length;
  const limitedItems = items.slice(0, maxItems);
  const products = parseProducts(limitedItems, feedCategory);
  const truncated = Boolean(options.truncated) || items.length > maxItems;

  return {
    status: truncated ? "truncated" : products.length > 0 ? "success" : "empty",
    products,
    parsedCount: limitedItems.length,
    validCount: products.length,
    skippedCount: Math.max(0, limitedItems.length - products.length),
    truncated,
  };
}

export function parseHeurekaXml(xml: string, feedCategory: string): ParsedProduct[] {
  return parseHeurekaXmlDetailed(xml, feedCategory, { maxItems: HEUREKA_MAX_ITEMS }).products;
}
