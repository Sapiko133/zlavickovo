import { getDb } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Read-only reporting pre identifikátory produktov (EAN/item_id/manufacturer/productno).
// Podklad pre budúce párovanie rovnakých produktov medzi obchodmi.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();

    const [totals] = (await sql`
      SELECT
        COUNT(*)::int                                                AS total,
        COUNT(*) FILTER (WHERE ean <> '')::int                       AS with_ean,
        COUNT(*) FILTER (WHERE item_id <> '')::int                   AS with_item_id,
        COUNT(*) FILTER (WHERE manufacturer <> '')::int              AS with_manufacturer,
        COUNT(*) FILTER (WHERE productno <> '')::int                 AS with_productno,
        COUNT(DISTINCT ean) FILTER (WHERE ean <> '')::int            AS unique_ean
      FROM hk_products
    `) as {
      total: number;
      with_ean: number;
      with_item_id: number;
      with_manufacturer: number;
      with_productno: number;
      unique_ean: number;
    }[];

    // EAN, ktorý sa vyskytuje vo viac ako jednom obchode (doméne)
    const [multi] = (await sql`
      SELECT COUNT(*)::int AS n FROM (
        SELECT ean
        FROM hk_products
        WHERE ean <> ''
        GROUP BY ean
        HAVING COUNT(DISTINCT domain) > 1
      ) t
    `) as { n: number }[];

    return Response.json({
      ok: true,
      total: totals.total,
      withEan: totals.with_ean,
      withItemId: totals.with_item_id,
      withManufacturer: totals.with_manufacturer,
      withProductno: totals.with_productno,
      uniqueEan: totals.unique_ean,
      eanInMultipleShops: multi.n,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
