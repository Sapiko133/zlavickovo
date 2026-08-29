import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/articles";

export const alt = "Aktuálna akcia na Zlavickovo.sk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

function shorten(value: string, limit: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/** Overí, že URL vracia skutočný obrázok (aby Satori render nespadol). */
async function usableImage(url?: string): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const type = res.headers.get("content-type") || "";
    return res.ok && type.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}

export default async function ActionImage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  const shopName = article?.shopName || "Zlavickovo";
  const title = shorten(article?.title || "Aktuálna akcia a výhodná ponuka", 105);
  const domain = article?.domain || "zlavickovo.sk";
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
  const validity = article?.validTo
    ? `Platí do ${new Date(article.validTo).toLocaleDateString("sk-SK")}`
    : "Aktuálna ponuka";
  const badge = article?.discountPct ? `ZĽAVA AŽ -${article.discountPct}%` : "AKTUÁLNA AKCIA";
  const titleSize = title.length > 82 ? 44 : title.length > 58 ? 51 : 59;

  // Ak máme REÁLNU kreatívu inzerenta, použijeme ju (aj pre FB auto-posting) namiesto
  // generickej grafiky — s jemným spodným brand pruhom.
  const creative = await usableImage(article?.imageUrl);
  if (creative) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0f172a" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creative} width={1200} height={630} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              padding: "26px 44px",
              background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 800 }}>
              <span style={{ color: "#4ade80", marginRight: 10 }}>✂</span>
              Zlavickovo.sk
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                borderRadius: 999,
                padding: "10px 22px",
                background: "#22c55e",
                color: "#052e16",
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              {badge}
            </div>
          </div>
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          padding: "62px 68px",
          color: "white",
          background: "linear-gradient(135deg, #07111f 0%, #0f172a 58%, #14532d 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "rgba(34,197,94,0.18)",
            right: -130,
            top: -190,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 330,
            height: 330,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.08)",
            left: -150,
            bottom: -190,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", width: 780, zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 800 }}>
            <span style={{ color: "#4ade80", marginRight: 10 }}>✂</span>
            Zlavickovo.sk
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 54,
              alignSelf: "flex-start",
              borderRadius: 999,
              padding: "10px 20px",
              background: "#22c55e",
              color: "#052e16",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 0.5,
            }}
          >
            {badge}
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: titleSize, lineHeight: 1.08, fontWeight: 900, letterSpacing: -1.4 }}>
            {title}
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 23, color: "#cbd5e1", fontWeight: 600 }}>
            {validity} · Podmienky si over pri otvorení obchodu
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            width: 260,
            height: 390,
            alignSelf: "center",
            borderRadius: 36,
            padding: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.28)",
            zIndex: 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={favicon} alt="" width="150" height="150" style={{ borderRadius: 30 }} />
          <div style={{ display: "flex", color: "#0f172a", fontSize: 31, fontWeight: 900, textAlign: "center", marginTop: 28 }}>
            {shorten(shopName, 28)}
          </div>
          <div style={{ display: "flex", color: "#16a34a", fontSize: 18, fontWeight: 800, marginTop: 12 }}>
            Pozrieť ponuku →
          </div>
        </div>
      </div>
    ),
    size,
  );
}
