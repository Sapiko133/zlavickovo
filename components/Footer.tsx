import { T } from "@/lib/design-tokens";

const FEATURES = [
  { icon: "🏷️", title: "Kupóny a zľavy",  desc: "Overené kódy pre 100+ obchodov" },
  { icon: "💰", title: "Cashback",         desc: "Získaj časť peňazí späť" },
  { icon: "📋", title: "Letáky",           desc: "Týždenné letáky supermarketov" },
  { icon: "🛡️", title: "Bezpečné nákupy", desc: "Overené obchody a spoľahlivé odkazy" },
];

const LINKS = [
  { label: "Kupóny",    href: "/kupony" },
  { label: "Obchody",   href: "/obchody" },
  { label: "Akcie",     href: "/akcie" },
  { label: "Letáky",    href: "/letaky" },
  { label: "Blog",      href: "/blog" },
];

const LEGAL = [
  { label: "Súkromie",  href: "/privacy" },
  { label: "O nás",     href: "/o-nas" },
  { label: "Inzercia",  href: "/inzercia" },
  { label: "Kontakt",   href: "mailto:info@zlavickovo.sk" },
];

export default function Footer() {
  return (
    <footer style={{ fontFamily: T.fontSans }}>
      {/* Trust feature strip */}
      <div style={{ background: T.bgAlt, borderTop: `1px solid ${T.border}`, padding: "32px 24px" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "14px 16px", borderRadius: T.rMd,
              background: T.white, border: `1px solid ${T.border}`,
              boxShadow: T.shadowXs,
            }}>
              <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dark footer */}
      <div style={{ background: "#111827", padding: "40px 24px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Top row: brand + nav columns */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, paddingBottom: 32, borderBottom: "1px solid #1F2937" }}>
            {/* Brand */}
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", marginBottom: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: T.rSm, background: T.green,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.white, fontSize: 16, fontWeight: 900,
                }}>Z</div>
                <span style={{ fontWeight: 800, fontSize: 16, color: T.white }}>
                  Zlavickovo<span style={{ color: T.green }}>.sk</span>
                </span>
              </a>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, margin: 0, maxWidth: 220 }}>
                Kupóny, cashback a akcie pre slovenské obchody. Overené kódy denne.
              </p>
            </div>

            {/* Nav links */}
            <div style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Portál</div>
              {LINKS.map(l => (
                <a key={l.href} href={l.href} style={{
                  display: "block", fontSize: 13, color: "#9CA3AF", textDecoration: "none",
                  marginBottom: 10, transition: T.transBase,
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = T.green}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "#9CA3AF"}
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Legal links */}
            <div style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Spoločnosť</div>
              {LEGAL.map(l => (
                <a key={l.href} href={l.href} style={{
                  display: "block", fontSize: 13, color: "#9CA3AF", textDecoration: "none",
                  marginBottom: 10, transition: T.transBase,
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = T.green}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "#9CA3AF"}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          {/* Bottom copyright */}
          <div style={{ padding: "18px 0 20px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#4B5563" }}>© 2026 Zlavickovo.sk – Všetky práva vyhradené</span>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 11, color: "#374151" }}>🔒 SSL Zabezpečené</span>
              <span style={{ fontSize: 11, color: "#374151" }}>✓ GDPR</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
