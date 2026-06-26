import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LETAKY.map(l => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const letak = LETAKY.find(l => l.slug === slug);
  if (!letak) return {};
  const month = new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(new Date());
  const year = new Date().getFullYear();

  return {
    title: `${letak.name} leták aktuálny ${month} ${year}`,
    description: `Aktuálny ${letak.name} leták ${month} ${year}. ${letak.updateText.charAt(0).toUpperCase() + letak.updateText.slice(1)}. Nájdite najlepšie akcie a zľavy.`,
    alternates: { canonical: `https://zlavickovo.sk/letaky/${slug}` },
    openGraph: {
      title: `${letak.name} leták ${month} ${year} | Zlavickovo`,
      description: `Aktuálny ${letak.name} leták online. ${letak.updateText}.`,
      type: "website",
      locale: "sk_SK",
    },
  };
}

export default async function LetatPage({ params }: Props) {
  const { slug } = await params;
  const letak = LETAKY.find(l => l.slug === slug);
  if (!letak) notFound();

  const expiry = getExpiryDate(letak.newDayOfWeek);
  const expiringSoon = isExpiringSoon(expiry);
  const month = new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(new Date());
  const year = new Date().getFullYear();

  const faq = [
    {
      q: `Kedy vychádza nový ${letak.name} leták?`,
      a: `Nový ${letak.name} leták vychádza ${letak.updateText}. Aktuálny leták je platný do ${formatDate(expiry)}.`,
    },
    {
      q: `Kde nájdem aktuálny ${letak.name} leták online?`,
      a: `Aktuálny ${letak.name} leták nájdete online priamo na oficiálnej stránke ${letak.name} alebo tu na Zlavickovo.sk, kde vás presmerujeme na aktuálnu verziu.`,
    },
    {
      q: `Ako dlho platí ${letak.name} leták?`,
      a: `${letak.name} leták platí spravidla jeden týždeň. Aktuálny leták je platný do ${formatDate(expiry)}. ${letak.updateText.charAt(0).toUpperCase() + letak.updateText.slice(1)}.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Zlavickovo", "item": "https://zlavickovo.sk" },
          { "@type": "ListItem", "position": 2, "name": "Letáky", "item": "https://zlavickovo.sk/letaky" },
          { "@type": "ListItem", "position": 3, "name": letak.name, "item": `https://zlavickovo.sk/letaky/${slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <a href="/letaky" style={{ color: "#7C3AED", textDecoration: "none" }}>← Letáky</a>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 24px 0", fontSize: 12, color: "#aaa" }}>
        <a href="/" style={{ color: "#aaa", textDecoration: "none" }}>Zlavickovo</a>
        {" › "}
        <a href="/letaky" style={{ color: "#aaa", textDecoration: "none" }}>Letáky</a>
        {" › "}
        <span style={{ color: "#555" }}>{letak.name}</span>
      </div>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "48px 24px 40px", textAlign: "center" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, margin: "0 auto 20px",
          background: letak.color, display: "flex", alignItems: "center", justifyContent: "center",
          color: letak.color === "#FFCC00" ? "#333" : "#fff", fontWeight: 900, fontSize: 30,
          boxShadow: `0 8px 24px ${letak.color}55`,
        }}>
          {letak.letter}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px", margin: "0 0 8px" }}>
          {letak.name} leták {month} {year}
        </h1>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "#f0fdf4", color: "#16a34a" }}>
            Platný do {formatDate(expiry)}
          </span>
          {expiringSoon && (
            <span style={{ fontSize: 13, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "#fee2e2", color: "#dc2626" }}>
              ⚠ Expiruje čoskoro!
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "#f3f4f6", color: "#555" }}>
            {letak.updateText}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* CTA */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <a
            href={letak.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            style={{
              display: "inline-block", padding: "16px 40px", borderRadius: 14,
              background: "linear-gradient(135deg, #7C3AED, #2563EB)",
              color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
            }}
          >
            Zobraziť aktuálny {letak.name} leták →
          </a>
        </div>

        {/* FAQ */}
        <div style={{ background: "#fafafa", borderRadius: 20, padding: "32px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 24px" }}>
            Časté otázky – {letak.name} leták
          </h2>
          {faq.map((item, i) => (
            <div key={i} style={{ padding: "18px 0", borderBottom: i < faq.length - 1 ? "1px solid #ebebeb" : "none" }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", marginBottom: 8 }}>{item.q}</div>
              <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
