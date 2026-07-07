import { XMLParser } from "fast-xml-parser";
import { HEUREKA_MAX_ITEMS } from "./config";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

// Bezpečné čítanie skalárneho poľa — vráti "" ak je hodnota objekt (napr. nested XML)
function pickStr(item: any, ...keys: string[]): string {
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
  url: string;
  imgUrl: string;
  category: string;
  ean: string;
  itemId: string;
  manufacturer: string;
  productno: string;
}

export function parseHeurekaXml(xml: string, feedCategory: string): ParsedProduct[] {
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  // Heureka štandard: <SHOP><SHOPITEM>...</SHOPITEM></SHOP>
  // Niektoré feedy majú RSS wrapper: <rss><SHOP><SHOPITEM>...
  const shopRoot =
    parsed?.SHOP ??
    parsed?.shop ??
    parsed?.rss?.SHOP ??
    parsed?.rss?.shop ??
    parsed?.RSS?.SHOP ??
    parsed?.RSS?.shop ??
    parsed;
  const rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
  if (!rawItems) return [];

  const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter((item: any) => item && typeof item === "object")
    .slice(0, HEUREKA_MAX_ITEMS)
    .map((item: any): ParsedProduct => {
      const rawCategory = String(
        item.CATEGORY_FULL ?? item.CATEGORYTEXT ?? item.categorytext ?? ""
      ).trim();
      return {
        name: String(item.PRODUCTNAME ?? item.NAME ?? item.productname ?? item.name ?? "").trim(),
        description: stripHtml(
          String(item.DESCRIPTION ?? item.description ?? "")
        ).slice(0, 300),
        price: String(item.PRICE_VAT ?? item.PRICE ?? item.price ?? "").trim(),
        url: String(item.URL ?? item.url ?? "").trim(),
        imgUrl: String(
          item.IMGURL ?? item.IMAGE_MAIN ?? item.IMGURL_ALTERNATIVE ?? item.imgurl ?? ""
        ).trim(),
        // Preferuj kategóriu z feeda, fallback na feedCategory
        category: rawCategory || feedCategory,
        ean: pickStr(item, "EAN", "ean"),
        itemId: pickStr(item, "ITEM_ID", "item_id"),
        manufacturer: pickStr(item, "MANUFACTURER", "manufacturer"),
        // PRODUCTNO s fallbackom na ISBN (knižné feedy)
        productno: pickStr(item, "PRODUCTNO", "productno", "ISBN", "isbn"),
      };
    })
    .filter((p) => p.name && p.url);
}
