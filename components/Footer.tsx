export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #f0f0f0", background: "#fff" }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "28px 48px",
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center",
        gap: 16, fontSize: 13,
      }}>
        <span style={{ fontWeight: 700, color: "#1d1d1f", fontSize: 14 }}>Zlavickovo</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <a href="/o-nas" style={{ color: "#666", textDecoration: "none" }}>O nás</a>
          <a href="/cashback" style={{ color: "#666", textDecoration: "none" }}>Cashback</a>
          <a href="/inzercia" style={{ color: "#666", textDecoration: "none" }}>Inzercia</a>
          <a href="/privacy" style={{ color: "#666", textDecoration: "none" }}>Ochrana súkromia</a>
          <a href="mailto:info@zlavickovo.sk" style={{ color: "#666", textDecoration: "none" }}>Kontakt</a>
        </div>
        <span style={{ color: "#aaa" }}>© 2026 Zlavickovo</span>
      </div>
    </footer>
  );
}
