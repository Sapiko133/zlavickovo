import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/jsonld";

/**
 * Viditeľné, klikateľné breadcrumbs. Rovnaký zoznam položiek generuje aj
 * BreadcrumbList v JSON-LD stránky (breadcrumbJsonLd) — vizuál a schema
 * sa tak nemôžu rozísť. Posledná položka = aktuálna stránka (bez odkazu).
 */
export default function Breadcrumbs({ items, color = "#6B7280", activeColor = "#374151" }: {
  items: Crumb[];
  color?: string;
  activeColor?: string;
}) {
  return (
    <nav aria-label="Omrvinková navigácia" style={{ fontSize: 12, color }}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              {last || !c.path ? (
                <span aria-current={last ? "page" : undefined} style={{ color: last ? activeColor : color, fontWeight: last ? 600 : 400, overflowWrap: "anywhere" }}>
                  {c.name}
                </span>
              ) : (
                // padding → cieľ dotyku ≥ 24 px výšky (WCAG 2.2 target size) bez zmeny vizuálu
                <a href={c.path} style={{ color, textDecoration: "none", display: "inline-block", padding: "3px 0", minHeight: 24, boxSizing: "border-box" }}>{c.name}</a>
              )}
              {!last && <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { breadcrumbJsonLd };
