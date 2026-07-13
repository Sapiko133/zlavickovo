import { NextRequest } from "next/server";
import {
  cleanupPriceHistory,
  RETENTION_DAYS,
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_BATCHES,
} from "@/lib/heureka/price-history-retention";

export const dynamic = "force-dynamic";
// Batch DELETE cez viac dávok môže trvať dlhšie než default; drž sa route stropu.
export const maxDuration = 300;

// Bezpečné hranice pre verejné query parametre. retentionDays NIE je verejne
// nastaviteľný — produkčná retencia ostáva pevných 120 dní (§27 bezpečnosť:
// interné endpointy nesmú byť zneužiteľné na manipuláciu dát).
const BATCH_SIZE_MIN = 1_000;
const BATCH_SIZE_MAX = 50_000;
const MAX_BATCHES_MIN = 1;
const MAX_BATCHES_MAX = 50;

function clampParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const batchSize = clampParam(
      searchParams.get("batchSize"),
      DEFAULT_BATCH_SIZE,
      BATCH_SIZE_MIN,
      BATCH_SIZE_MAX
    );
    const maxBatches = clampParam(
      searchParams.get("maxBatches"),
      DEFAULT_MAX_BATCHES,
      MAX_BATCHES_MIN,
      MAX_BATCHES_MAX
    );

    const result = await cleanupPriceHistory({
      retentionDays: RETENTION_DAYS,
      batchSize,
      maxBatches,
    });

    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    // Nikdy nevypisuj secret ani DATABASE_URL — len generickú správu.
    console.error("[price-history-cleanup]", err?.message ?? err);
    return Response.json(
      { ok: false, error: "Price history cleanup failed" },
      { status: 500 }
    );
  }
}
