const cache = new Map<string, { data: any; ts: number }>();
const TTL = 24 * 60 * 60 * 1000; // 24 hodín

export function getCache(key: string) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

export function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}