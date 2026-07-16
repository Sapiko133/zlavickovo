import { getDb } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Whitelist tabuliek, na ktorých je povolená údržba (VACUUM). Identifikátor sa
// nedá parametrizovať, preto tvrdý whitelist proti SQL injection.
const MAINTAINABLE = new Set(["hk_products", "product_price_history"]);

/**
 * DB údržba a diagnostika veľkosti (Neon 512 MB strop).
 *  - ?action=sizes (default): veľkosť DB + per-tabuľka total/table/index + dead tuples
 *  - ?action=vacuum&table=hk_products: VACUUM (ANALYZE) — uvoľní dead tuples na reuse
 *  - ?action=vacuum_full&table=hk_products: VACUUM FULL — prepíše tabuľku a zmenší
 *    ju na disku (POZOR: potrebuje zámok + docasne miesto; pri plnom disku môže
 *    zlyhať rovnakou chybou). Používať až po znížení Neon retencie.
 *  - ?action=prune_price_history&keepDays=2: zmaže cenovú históriu staršiu ako N dní
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const action = req.nextUrl.searchParams.get("action") ?? "sizes";
  const table = req.nextUrl.searchParams.get("table") ?? "";

  try {
    if (action === "sizes") {
      const [db] = (await sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty,
               pg_database_size(current_database())::bigint          AS bytes
      `) as { pretty: string; bytes: string }[];

      const tables = (await sql`
        SELECT relname                                                            AS name,
               pg_size_pretty(pg_total_relation_size(relid))                      AS total,
               pg_size_pretty(pg_relation_size(relid))                            AS heap,
               pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS idx_toast,
               pg_total_relation_size(relid)::bigint                              AS total_bytes,
               n_live_tup                                                         AS live,
               n_dead_tup                                                         AS dead,
               to_char(last_autovacuum, 'YYYY-MM-DD HH24:MI')                     AS last_autovacuum,
               to_char(last_vacuum, 'YYYY-MM-DD HH24:MI')                         AS last_vacuum
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
      `) as unknown[];

      return Response.json({
        ok: true,
        limitMb: 512,
        database: { size: db.pretty, bytes: Number(db.bytes) },
        tables,
      });
    }

    if (action === "vacuum" || action === "vacuum_full") {
      if (!MAINTAINABLE.has(table)) {
        return Response.json(
          { ok: false, error: `table musí byť z whitelistu: ${[...MAINTAINABLE].join(", ")}` },
          { status: 400 }
        );
      }
      const started = Date.now();
      const stmt = action === "vacuum_full" ? `VACUUM (FULL, ANALYZE) ${table}` : `VACUUM (ANALYZE) ${table}`;
      // neon HTTP driver = single-statement auto-commit → VACUUM tu smie bežať
      await sql.query(stmt);
      return Response.json({ ok: true, action, table, durationMs: Date.now() - started });
    }

    if (action === "prune_price_history") {
      const keepDays = Math.max(1, parseInt(req.nextUrl.searchParams.get("keepDays") ?? "2", 10) || 2);
      const [{ deleted }] = (await sql`
        WITH d AS (
          DELETE FROM product_price_history
          WHERE recorded_day < (CURRENT_DATE - ${keepDays}::int)
          RETURNING 1
        )
        SELECT COUNT(*)::int AS deleted FROM d
      `) as { deleted: number }[];
      return Response.json({ ok: true, action, keepDays, deleted });
    }

    return Response.json({ ok: false, error: `neznáma action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
