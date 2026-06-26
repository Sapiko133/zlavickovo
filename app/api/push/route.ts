export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = req.headers.get("x-push-secret");
  if (!secret || secret !== process.env.NEWSLETTER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; message?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, message, url } = body;
  if (!title || !message) {
    return Response.json({ error: "Missing title or message" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    return Response.json({ error: "OneSignal not configured" }, { status: 500 });
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
        headings: { sk: title },
        contents: { sk: message },
        ...(url ? { url, web_url: url } : {}),
      }),
    });
    const data = await res.json();
    return Response.json({ ok: true, data });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
