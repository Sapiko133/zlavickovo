import { getDb } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Zastarané tabuľky z odstránenej Heureky / produktového katalógu. DROP je
// idempotentný (IF EXISTS) a bezpečne opakovateľný. shop_descriptions a
// analytické tabuľky sa NEdotýkame.
const OBSOLETE_TABLES = [
  "hk_products",
  "hk_feeds",
  "hk_import_runs",
  "hk_import_run_feeds",
  "hk_import_locks",
  "product_price_history",
  "price_watches",
];

/**
 * DB údržba a diagnostika (Neon).
 *  - ?action=sizes (default): veľkosť DB + per-tabuľka total/table/index + dead tuples
 *  - ?action=drop_obsolete: dropne zastarané Heureka/produktové tabuľky (idempotentné).
 *    Uvoľní storage po odstránení produktového katalógu; 402 quota root cause
 *    (ťažký import) je už odstránený v kóde.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const action = req.nextUrl.searchParams.get("action") ?? "sizes";

  try {
    if (action === "sizes") {
      const [db] = (await sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty,
               pg_database_size(current_database())::bigint          AS bytes
      `) as { pretty: string; bytes: string }[];

      const tables = (await sql`
        SELECT relname                                                            AS name,
               pg_size_pretty(pg_total_relation_size(relid))                      AS total,
               pg_total_relation_size(relid)::bigint                              AS total_bytes,
               n_live_tup                                                         AS live,
               n_dead_tup                                                         AS dead
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

    if (action === "drop_obsolete") {
      const started = Date.now();
      const dropped: string[] = [];
      for (const table of OBSOLETE_TABLES) {
        // Identifikátor je z tvrdého whitelistu (žiadny user input) → bezpečné.
        await sql.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        dropped.push(table);
      }
      return Response.json({ ok: true, action, dropped, durationMs: Date.now() - started });
    }

    return Response.json({ ok: false, error: `neznáma action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
