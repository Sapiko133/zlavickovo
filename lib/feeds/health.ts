import { redis } from "@/lib/redis";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { FEEDS as AFFIAL_PRODUCT_FEEDS } from "./AffialFeedProvider";
import type { ImportResult, ProviderImportResult } from "./FeedManager";

export type ProviderId = "dognet" | "affial" | "ehub" | "cj";
export type HealthStatus = "healthy" | "warning" | "missing" | "error" | "unsupported";
export type MetricStatus = "ok" | "empty" | "missing" | "error" | "unsupported" | "static";

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
  configuredFeeds: number | null;
  cachedFeeds: number | null;
  missingFeeds: number | null;
  cacheTtlSeconds: number | null;
  products: HealthMetric;
  coupons: HealthMetric;
  lastImportAt: string | null;
  lastImportStatus: ProviderImportResult["status"] | "never" | "unknown";
  message: string;
  error: string | null;
}

interface CacheSetInspection {
  status: Exclude<MetricStatus, "unsupported" | "static">;
  count: number | null;
  feedIds: number | null;
  cachedFeeds: number | null;
  missingFeeds: number | null;
  minTtlSeconds: number | null;
  error: string | null;
}

interface ArrayCacheInspection {
  status: Exclude<MetricStatus, "unsupported" | "static">;
  count: number | null;
  ttlSeconds: number | null;
  error: string | null;
}

const LAST_IMPORT_KEY = "feed:last_import";
const EHUB_STATIC_PRODUCT_FEEDS = 5;

function safeError(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason);
  return raw.replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").trim().slice(0, 220) || "Neznáma chyba";
}

export function evaluateCacheSet(input: {
  feedIds: number;
  cachedFeeds: number;
  count: number;
  failedReads?: number;
}): CacheSetInspection["status"] {
  if ((input.failedReads ?? 0) > 0) return "error";
  if (input.feedIds === 0 || input.cachedFeeds === 0) return "missing";
  if (input.cachedFeeds < input.feedIds) return "missing";
  return input.count > 0 ? "ok" : "empty";
}

export function deriveProviderStatus(input: {
  productStatus: MetricStatus;
  couponStatus: MetricStatus;
  importStatus?: ProviderImportResult["status"] | "never" | "unknown";
}): HealthStatus {
  const activeStatuses = [input.productStatus, input.couponStatus].filter((status) => status !== "unsupported");
  if (activeStatuses.length === 0) return "unsupported";
  if (activeStatuses.includes("error") || input.importStatus === "error") return "error";
  if (activeStatuses.every((status) => status === "missing")) return "missing";
  if (
    activeStatuses.includes("missing") ||
    activeStatuses.includes("empty") ||
    input.importStatus === "empty" ||
    input.importStatus === "never" ||
    input.importStatus === "unknown"
  ) {
    return "warning";
  }
  return "healthy";
}

async function inspectProductCacheSet(setKey: string, productKeyPrefix: string): Promise<CacheSetInspection> {
  try {
    const ids = (await redis.smembers(setKey)) as string[];
    if (ids.length === 0) {
      return {
        status: "missing",
        count: 0,
        feedIds: 0,
        cachedFeeds: 0,
        missingFeeds: 0,
        minTtlSeconds: null,
        error: null,
      };
    }

    const reads = await Promise.allSettled(
      ids.map(async (id) => {
        const key = `${productKeyPrefix}${id}`;
        const [products, ttl] = await Promise.all([
          redis.get<unknown>(key),
          redis.ttl(key),
        ]);
        return {
          exists: Array.isArray(products),
          count: Array.isArray(products) ? products.length : 0,
          ttl: typeof ttl === "number" ? ttl : null,
        };
      })
    );

    const fulfilled = reads.filter((read): read is PromiseFulfilledResult<{ exists: boolean; count: number; ttl: number | null }> => read.status === "fulfilled");
    const cached = fulfilled.filter((read) => read.value.exists);
    const failedReads = reads.length - fulfilled.length;
    const count = cached.reduce((sum, read) => sum + read.value.count, 0);
    const positiveTtls = cached.map((read) => read.value.ttl).filter((ttl): ttl is number => typeof ttl === "number" && ttl >= 0);
    const status = evaluateCacheSet({ feedIds: ids.length, cachedFeeds: cached.length, count, failedReads });

    return {
      status,
      count: failedReads > 0 ? null : count,
      feedIds: ids.length,
      cachedFeeds: cached.length,
      missingFeeds: ids.length - cached.length,
      minTtlSeconds: positiveTtls.length > 0 ? Math.min(...positiveTtls) : null,
      error: failedReads > 0 ? `${failedReads} cache čítaní zlyhalo` : null,
    };
  } catch (error) {
    return {
      status: "error",
      count: null,
      feedIds: null,
      cachedFeeds: null,
      missingFeeds: null,
      minTtlSeconds: null,
      error: safeError(error),
    };
  }
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

function providerImport(lastImport: ImportResult | null, provider: Exclude<ProviderId, "heureka">): ProviderImportResult | null {
  return lastImport?.[provider] ?? null;
}

function redisProviderHealth(input: {
  id: Exclude<ProviderId, "heureka" | "cj">;
  label: string;
  configured: boolean;
  configuredFeeds: number | null;
  products: CacheSetInspection;
  coupons: ArrayCacheInspection | HealthMetric;
  lastImport: ImportResult | null;
}): FeedProviderHealth {
  const imported = providerImport(input.lastImport, input.id);
  const couponMetric: HealthMetric = "ttlSeconds" in input.coupons
    ? { count: input.coupons.count, status: input.coupons.status, detail: input.coupons.error ?? undefined }
    : input.coupons;
  const status = deriveProviderStatus({
    productStatus: input.products.status,
    couponStatus: couponMetric.status,
    importStatus: imported?.status ?? (input.lastImport ? "unknown" : "never"),
  });
  const missing = input.products.missingFeeds ?? 0;
  const message = input.products.status === "error"
    ? "Produktovú cache sa nepodarilo prečítať."
    : input.products.status === "missing"
      ? missing > 0
        ? `${missing} z ${input.products.feedIds ?? "?"} produktových cache kľúčov chýba.`
        : "Produktová cache nie je vytvorená."
      : couponMetric.status === "missing"
        ? "Produkty sú dostupné, coupon cache chýba."
        : imported?.status === "error"
          ? "Posledný import providera zlyhal; zobrazené počty sú z poslednej cache."
          : "Cache a posledný import majú použiteľné dáta.";

  return {
    id: input.id,
    label: input.label,
    status,
    configured: input.configured,
    configuredFeeds: input.configuredFeeds,
    cachedFeeds: input.products.cachedFeeds,
    missingFeeds: input.products.missingFeeds,
    cacheTtlSeconds: input.products.minTtlSeconds,
    products: { count: input.products.count, status: input.products.status, detail: input.products.error ?? undefined },
    coupons: couponMetric,
    lastImportAt: input.lastImport?.timestamp ?? null,
    lastImportStatus: imported?.status ?? (input.lastImport ? "unknown" : "never"),
    message,
    error: input.products.error ?? couponMetric.detail ?? imported?.error ?? null,
  };
}

async function inspectCj(lastImport: ImportResult | null): Promise<FeedProviderHealth> {
  const coupons = await inspectArrayCache("cj:coupons:v3");
  const imported = providerImport(lastImport, "cj");
  const status = deriveProviderStatus({
    productStatus: "unsupported",
    couponStatus: coupons.status,
    importStatus: imported?.status ?? (lastImport ? "unknown" : "never"),
  });
  const configured = Boolean(process.env.CJ_API_KEY && process.env.CJ_WEBSITE_ID);

  return {
    id: "cj",
    label: "CJ",
    status: configured ? status : "warning",
    configured,
    configuredFeeds: configured ? 1 : 0,
    cachedFeeds: coupons.status === "ok" || coupons.status === "empty" ? 1 : 0,
    missingFeeds: coupons.status === "missing" ? 1 : 0,
    cacheTtlSeconds: coupons.ttlSeconds,
    products: { count: null, status: "unsupported", detail: "CJ product feed nie je importovaný" },
    coupons: { count: coupons.count, status: coupons.status, detail: coupons.error ?? undefined },
    lastImportAt: lastImport?.timestamp ?? null,
    lastImportStatus: imported?.status ?? (lastImport ? "unknown" : "never"),
    message: configured
      ? coupons.status === "missing"
        ? "CJ je nakonfigurované, ale coupon cache chýba."
        : "CJ je coupon zdroj; produktový feed zatiaľ nie je súčasťou importu."
      : "Chýba CJ_API_KEY alebo CJ_WEBSITE_ID.",
    error: coupons.error ?? imported?.error ?? null,
  };
}

export async function getFeedProviderHealth(): Promise<FeedProviderHealth[]> {
  let lastImport: ImportResult | null = null;
  try {
    lastImport = await redis.get<ImportResult>(LAST_IMPORT_KEY);
  } catch {
    // Jednotlivé Redis kontroly nižšie vrátia explicitný error stav.
  }

  const [dognetProducts, dognetCoupons, affialProducts, ehubProducts, ehubCoupons, cj] = await Promise.all([
    inspectProductCacheSet("dognet:feed_ids", "dognet_products:"),
    inspectArrayCache("dognet:coupons:v3"),
    inspectProductCacheSet("affial:feed_domains", "feed:"),
    inspectProductCacheSet("ehub:feed_ids", "ehub_products:"),
    inspectArrayCache("ehub:coupons:v3"),
    inspectCj(lastImport),
  ]);

  const affialCoupons: HealthMetric = {
    count: AFFIAL_COUPONS.length,
    status: "static",
    detail: "Manuálne evidované kódy; nejde o live verification",
  };

  return [
    redisProviderHealth({
      id: "dognet",
      label: "Dognet",
      configured: Boolean(process.env.DOGNET_EMAIL && process.env.DOGNET_PASSWORD),
      configuredFeeds: dognetProducts.feedIds,
      products: dognetProducts,
      coupons: dognetCoupons,
      lastImport,
    }),
    redisProviderHealth({
      id: "affial",
      label: "Affial",
      configured: AFFIAL_PRODUCT_FEEDS.length > 0,
      configuredFeeds: AFFIAL_PRODUCT_FEEDS.length,
      products: affialProducts,
      coupons: affialCoupons,
      lastImport,
    }),
    redisProviderHealth({
      id: "ehub",
      label: "eHub",
      configured: true,
      configuredFeeds: EHUB_STATIC_PRODUCT_FEEDS,
      products: ehubProducts,
      coupons: ehubCoupons,
      lastImport,
    }),
    cj,
  ];
}

