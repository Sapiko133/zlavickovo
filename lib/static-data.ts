import fs from "fs";
import path from "path";

function readJson<T>(filename: string): T {
  try {
    const filepath = path.join(process.cwd(), "public", "data", filename);
    const raw = fs.readFileSync(filepath, "utf-8");
    const data = JSON.parse(raw);
    return (Array.isArray(data) ? data : []) as T;
  } catch {
    return [] as T;
  }
}

export function getStaticShops(): any[] {
  return readJson("shops.json");
}

export function getStaticEhubShops(): any[] {
  return readJson("ehub-shops.json");
}

export function getStaticSales(): any[] {
  return readJson("sales.json");
}

export function getStaticFeed(): any[] {
  return readJson("feed.json");
}

export function getStaticCoupons(): any[] {
  return readJson("coupons.json");
}
