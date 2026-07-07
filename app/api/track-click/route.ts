import { logOutboundClick, visitorHash, domainFromUrl, type ClickEvent } from "@/lib/click-log";
import { CLICK_TYPES, type ClickType } from "@/lib/click-types";

export const dynamic = "force-dynamic";

const TYPE_SET = new Set<string>(CLICK_TYPES);

function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Príjem outbound-klik eventov z klienta (sendBeacon/fetch). Neinvazívny dedup
 * na základe IP+UA hashu. Vždy vráti ok:true a nikdy nezhodí — tracking je
 * best-effort a nesmie ovplyvniť UX.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") return Response.json({ ok: true });

    const type = str((raw as any).type) as ClickType | null;
    if (!type || !TYPE_SET.has(type)) return Response.json({ ok: true });

    const destination = str((raw as any).destination, 500);
    const destinationDomain =
      str((raw as any).destinationDomain) || domainFromUrl(destination);

    const ev: ClickEvent = {
      timestamp: Date.now(),
      source: str((raw as any).source) || "other",
      type,
      shopSlug: str((raw as any).shopSlug, 120),
      productSlug: str((raw as any).productSlug, 200),
      couponId: str((raw as any).couponId, 120),
      couponCode: str((raw as any).couponCode, 120),
      destinationDomain,
      query: str((raw as any).query, 200),
    };

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const visitor = visitorHash(ip, ua);

    await logOutboundClick(ev, visitor);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
