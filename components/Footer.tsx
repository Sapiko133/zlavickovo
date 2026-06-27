export default function Footer() {
  return (
    <footer style={{ background: "#111", marginTop: 64 }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "40px 48px 32px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 32,
        alignItems: "start",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>Z</div>
            <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>Zlavickovo</span>
          </div>
          <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6, margin: 0, maxWidth: 320 }}>
            Aktuálne zľavové kódy a kupóny pre 100+ slovenských obchodov. AI vyhľadávanie zadarmo.
          </p>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#666", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12 }}>Portál</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="/obchody" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Obchody</a>
              <a href="/letaky" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Letáky</a>
              <a href="/cashback" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Cashback</a>
              <a href="/blog" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Blog</a>
            </div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12 }}>Info</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="/o-nas" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>O nás</a>
              <a href="/inzercia" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Inzercia</a>
              <a href="/privacy" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Súkromie</a>
              <a href="mailto:info@zlavickovo.sk" style={{ color: "#aaa", textDecoration: "none", fontSize: 13 }}>Kontakt</a>
            </div>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #222", padding: "16px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: 12 }}>© 2026 Zlavickovo. Všetky práva vyhradené.</span>
          <span style={{ color: "#555", fontSize: 12 }}>Partnerský program Dognet</span>
        </div>
      </div>
      <style>{`
        @media(max-width:640px){
          footer > div:first-child { grid-template-columns: 1fr !important; padding: 32px 20px 24px !important; }
          footer > div:last-child { padding: 14px 20px !important; flex-direction: column; gap: 4px; }
        }
      `}</style>
    </footer>
  );
}
