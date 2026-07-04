// Zdieľaný badge KUPÓN / AKCIA — kupón = má kód, akcia = bez kódu.
// Čistý prezentačný komponent, funguje v server aj client komponentoch.
export default function CouponTypeBadge({ kind }: { kind: "kupon" | "akcia" }) {
  const isKupon = kind === "kupon";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: "3px 8px",
        borderRadius: 9999,
        letterSpacing: "0.05em",
        flexShrink: 0,
        whiteSpace: "nowrap",
        background: isKupon ? "#DCFCE7" : "#DBEAFE",
        color: isKupon ? "#15803D" : "#1D4ED8",
      }}
    >
      {isKupon ? "KUPÓN" : "AKCIA"}
    </span>
  );
}
