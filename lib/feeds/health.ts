import { redis } from "@/lib/redis";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";

/**
 * Zdravie zdrojov kupónov/akcií (Dognet, eHub, CJ, Affial). Heureka a produktové
 * feedy sú odstránené — sledujeme len coupon cache jednotlivých sietí, aby admin
 * rozlíšil prázdny zdroj, expirovanú cache a technickú chybu (nie tichú nulu).
 */

export type ProviderId = "dognet" | "ehub" | "cj" | "affial";
export type HealthStatus = "healthy" | "warning" | "missing" | "error";
export type MetricStatus = "ok" | "empty" | "missing" | "error" | "static";

export interface HealthMetric {
  count: number | null;
  status: MetricStatus;
  detail?: string;
}

export interface FeedProviderHealth {
  id: ProviderId;
  label: string;
  status: HealthStatus;
  configured: boolean;
  coupons: HealthMetric;
  cacheTtlSeconds: number | null;
  message: string;
  error: string | null;
}

function safeError(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason);
  return raw.replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").trim().slice(0, 220) || "Neznáma chyba";
}

interface ArrayCacheInspection {
  status: Exclude<MetricStatus, "static">;
  count: number | null;
  ttlSeconds: number | null;
  error: string | null;
}

async function inspectArrayCache(key: string): Promise<ArrayCacheInspection> {
  try {
    const [value, ttl] = await Promise.all([redis.get<unknown>(key), redis.ttl(key)]);
    if (value === null) return { status: "missing", count: 0, ttlSeconds: null, error: null };
    if (!Array.isArray(value)) return { status: "error", count: null, ttlSeconds: null, error: "Cache má neočakávaný formát" };
    return {
      status: value.length > 0 ? "ok" : "empty",
      count: value.length,
      ttlSeconds: typeof ttl === "number" && ttl >= 0 ? ttl : null,
      error: null,
    };
  } catch (error) {
    return { status: "error", count: null, ttlSeconds: null, error: safeError(error) };
  }
}

function deriveStatus(configured: boolean, couponStatus: MetricStatus): HealthStatus {
  if (!configured) return "warning";
  if (couponStatus === "error") return "error";
  if (couponStatus === "missing") return "missing";
  if (couponStatus === "empty") return "warning";
  return "healthy";
}

async function inspectRedisCoupons(input: {
  id: Exclude<ProviderId, "affial">;
  label: string;
  configured: boolean;
  cacheKey: string;
  missingHint: string;
}): Promise<FeedProviderHealth> {
  const coupons = await inspectArrayCache(input.cacheKey);
  const status = deriveStatus(input.configured, coupons.status);
  const message = !input.configured
    ? input.missingHint
    : coupons.status === "missing"
      ? "Coupon cache chýba — čaká na prvé načítanie zo siete."
      : coupons.status === "empty"
        ? "Sieť je pripojená, ale nevrátila žiadne aktívne kupóny."
        : coupons.status === "error"
          ? "Coupon cache sa nepodarilo prečítať."
          : "Kupóny sú dostupné z cache.";

  return {
    id: input.id,
    label: input.label,
    status,
    configured: input.configured,
    coupons: { count: coupons.count, status: coupons.status, detail: coupons.error ?? undefined },
    cacheTtlSeconds: coupons.ttlSeconds,
    message,
    error: coupons.error ?? null,
  };
}

export async function getFeedProviderHealth(): Promise<FeedProviderHealth[]> {
  const [dognet, ehub, cj] = await Promise.all([
    inspectRedisCoupons({
      id: "dognet",
      label: "Dognet",
      configured: Boolean(process.env.DOGNET_EMAIL && process.env.DOGNET_PASSWORD),
      cacheKey: "dognet:coupons:v3",
      missingHint: "Chýba DOGNET_EMAIL alebo DOGNET_PASSWORD.",
    }),
    inspectRedisCoupons({
      id: "ehub",
      label: "eHub",
      configured: Boolean(process.env.EHUB_API_KEY),
      cacheKey: "ehub:coupons:v3",
      missingHint: "Chýba EHUB_API_KEY.",
    }),
    inspectRedisCoupons({
      id: "cj",
      label: "CJ",
      configured: Boolean(process.env.CJ_API_KEY && process.env.CJ_WEBSITE_ID),
      cacheKey: "cj:coupons:v3",
      missingHint: "Chýba CJ_API_KEY alebo CJ_WEBSITE_ID.",
    }),
  ]);

  const affial: FeedProviderHealth = {
    id: "affial",
    label: "Affial",
    status: AFFIAL_COUPONS.length > 0 ? "healthy" : "warning",
    configured: true,
    coupons: {
      count: AFFIAL_COUPONS.length,
      status: "static",
      detail: "Manuálne evidované kódy (lib/affial-coupons.ts)",
    },
    cacheTtlSeconds: null,
    message: "Affial kupóny sú evidované staticky v repozitári.",
    error: null,
  };

  return [dognet, ehub, cj, affial];
}
