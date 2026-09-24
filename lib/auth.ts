/**
 * Autentifikácia automatizačných a admin endpointov.
 *  - cron/CI: `Authorization: Bearer <CRON_SECRET>` (alebo x-cron-secret)
 *  - admin dashboard: httpOnly cookie `admin_session` (existujúci mechanizmus)
 * Porovnanie je timing-safe; bez nastaveného secretu je prístup vždy zamietnutý.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "admin_session";

function safeEqual(a: string, b: string): boolean {
  // Hash vyrovná dĺžky → timingSafeEqual neprezradí dĺžku secretu.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return safeEqual(auth, `Bearer ${secret}`) || (header !== "" && safeEqual(header, secret));
}

export async function isAdminSession(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) return false;
  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? "";
  return session !== "" && safeEqual(session, adminPassword);
}

/** Admin cookie ALEBO cron secret (dashboard aj automatizované kontroly). */
export async function isAdminOrCron(req: Request): Promise<boolean> {
  return isCronAuthorized(req) || (await isAdminSession());
}
