import { T } from "@/lib/design-tokens";
import { buildServerHeurekaSearchUrl } from "@/lib/heureka/affiliate";
import TrackedLink from "@/components/TrackedLink";

interface HeurekaPriceChartProps {
  ean?: string | null;
  name: string;
  productSlug: string;
  shopSlug?: string | null;
}

/**
 * Kompletný vývoj ceny → Heureka. Heureka neponúka embeddovateľný graf, ale na
 * svojej produktovej stránke zobrazuje históriu ceny naprieč obchodmi — čo my so
 * ~130 feed obchodmi spraviť nevieme (PROJECT_VISION §33: existuje lepšie MVP).
 * Preto namiesto rebuildovania grafu pošleme používateľa na Heureku cez
 * monetizovaný haff link (EAN preferovaný, inak názov). Bez fingovania grafu.
 *
 * Nie je to Trixam widget (žiadne positionid) → neporušuje pravidlo „jeden
 * Heureka widget na stránku"; je to obyčajný affiliate odkaz ako CTA fallback.
 */
export default function HeurekaPriceChart({ ean, name, productSlug, shopSlug }: HeurekaPriceChartProps) {
  const query = (ean || name || "").trim();
  if (!query) return null;

  const url = buildServerHeurekaSearchUrl(query);

  return (
    <div
      style={{
        background: T.white,
        border: `1.5px solid ${T.border}`,
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 24,
        maxWidth: 560,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, marginBottom: 3 }}>
            📈 Kompletný vývoj ceny
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
            Detailný graf vývoja ceny naprieč obchodmi nájdeš na Heureke.
          </div>
        </div>
        <TrackedLink
          href={url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          type="heureka_fallback"
          source="produkt-cenovy-graf"
          shopSlug={shopSlug ?? undefined}
          productSlug={productSlug}
          destinationDomain="www.heureka.sk"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            borderRadius: 10,
            background: T.bgAlt,
            color: T.greenDark,
            border: `1.5px solid ${T.border}`,
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Vývoj ceny na Heureke →
        </TrackedLink>
      </div>
    </div>
  );
}
