export const dynamic = "force-dynamic";

const BASE = "https://zlavickovo.sk";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    return Response.json({ ok: false, error: "OneSignal not configured" });
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["All"],
        headings: { sk: "🛒 Nový Lidl leták je tu!" },
        contents: { sk: "Pozri si akcie a zľavy v novom letáku pre tento týždeň" },
        url: `${BASE}/letaky/lidl`,
        web_url: `${BASE}/letaky/lidl`,
      }),
    });
    const data = await res.json();
    return Response.json({ ok: true, data });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
