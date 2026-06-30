import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

export interface ParsedProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  category: string;
}

export function parseHeurekaXml(xml: string, feedCategory: string): ParsedProduct[] {
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  // Heureka štandard: <SHOP><SHOPITEM>...</SHOPITEM></SHOP>
  const shopRoot = parsed?.SHOP ?? parsed?.shop ?? parsed;
  const rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
  if (!rawItems) return [];

  const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter((item: any) => item && typeof item === "object")
    .slice(0, 500)
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
      };
    })
    .filter((p) => p.name && p.url);
}
