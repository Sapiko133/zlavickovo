export default function Footer() {
  const FEATURES = [
    { icon: "🏷️", title: "Kupóny a zľavy", desc: "Overené kódy pre 100+ obchodov" },
    { icon: "💰", title: "Cashback",        desc: "Získaj časť peňazí späť" },
    { icon: "📋", title: "Letáky",          desc: "Týždenné letáky supermarketov" },
    { icon: "🛡️", title: "Bezpečné nákupy", desc: "Overené obchody a spoľahlivé odkazy" },
  ];

  return (
    <footer style={{ marginTop: 64 }}>
      {/* Feature boxes */}
      <div style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px", borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: "#fff", padding: "24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>Z</div>
            <span style={{ fontWeight: 700, color: "#1d1d1f", fontSize: 14 }}>Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span></span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a href="/privacy"  style={{ color: "#666", textDecoration: "none", fontSize: 13 }}>Súkromie</a>
            <a href="/o-nas"    style={{ color: "#666", textDecoration: "none", fontSize: 13 }}>O nás</a>
            <a href="/inzercia" style={{ color: "#666", textDecoration: "none", fontSize: 13 }}>Inzercia</a>
            <a href="mailto:info@zlavickovo.sk" style={{ color: "#666", textDecoration: "none", fontSize: 13 }}>Kontakt</a>
          </div>
          <span style={{ color: "#aaa", fontSize: 12 }}>© 2026 Zlavickovo.sk</span>
        </div>
      </div>
      <style>{`
        @media(max-width:640px){
          footer .feat-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </footer>
  );
}
