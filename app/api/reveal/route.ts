const rateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();

  const entry = rateLimit.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      return Response.json({ error: "Príliš veľa požiadaviek. Skúste o hodinu." }, { status: 429 });
    }
    entry.count++;
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + 3_600_000 });
  }

  const { token } = await req.json();
  if (!token) return Response.json({ error: "Chýba token" }, { status: 400 });

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const colonIdx = decoded.indexOf(":");
    const code = decoded.slice(colonIdx + 1);
    if (!code) throw new Error();
    return Response.json({ code });
  } catch {
    return Response.json({ error: "Neplatný token" }, { status: 400 });
  }
}
