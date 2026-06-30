// Zero JS — pure HTML form, server component
const POPULAR = [
  { label: "Alza",      href: "/kupony/alza" },
  { label: "Zalando",   href: "/kupony/zalando" },
  { label: "Shein",     href: "/kupony/shein" },
  { label: "Nike",      href: "/kupony/nike" },
  { label: "Notino",    href: "/kupony/notino" },
  { label: "GymBeam",   href: "/kupony/gymbeam" },
  { label: "Martinus",  href: "/kupony/martinus" },
];

export default function HeroSearch() {
  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <form action="/hladat" method="get" style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{
          display: "flex", borderRadius: 14, overflow: "hidden",
          border: "2px solid #22C55E",
          boxShadow: "0 4px 20px rgba(34,197,94,0.18)",
          background: "#fff",
        }}>
          <input
            name="q"
            type="search"
            placeholder="Hľadaj obchod alebo kupón..."
            autoComplete="off"
            style={{
              flex: 1, padding: "16px 20px",
              border: "none", background: "transparent",
              fontSize: 16, color: "#1d1d1f",
              outline: "none",
              fontFamily: "system-ui,-apple-system,sans-serif",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "16px 28px", border: "none",
              background: "#22C55E", color: "#fff",
              fontSize: 15, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "system-ui,-apple-system,sans-serif",
              flexShrink: 0,
              transition: "background .15s",
            }}
          >
            Hľadať
          </button>
        </div>
      </form>

      <div style={{
        marginTop: 14,
        display: "flex", gap: 8, justifyContent: "center",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 13, color: "#999", lineHeight: "30px", flexShrink: 0 }}>
          Populárne:
        </span>
        {POPULAR.map(item => (
          <a
            key={item.href}
            href={item.href}
            style={{
              padding: "5px 14px", borderRadius: 100,
              border: "1.5px solid #e8e8e8",
              background: "#f5f5f7", color: "#555",
              fontSize: 13, fontWeight: 500,
              textDecoration: "none", display: "inline-block",
              lineHeight: "20px",
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
