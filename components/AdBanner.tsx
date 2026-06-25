"use client";

type Slot = "header" | "sidebar" | "between-coupons";

const SIZES: Record<Slot, { width: number | string; height: number; label: string }> = {
  header:           { width: 728, height: 90,  label: "728×90 Leaderboard" },
  sidebar:          { width: 160, height: 600, label: "160×600 Sidebar" },
  "between-coupons":{ width: 300, height: 250, label: "300×250 Rectangle" },
};

export default function AdBanner({ slot }: { slot: Slot }) {
  const { width, height, label } = SIZES[slot];
  return (
    <div
      style={{
        width, height, maxWidth: "100%",
        background: "repeating-linear-gradient(45deg, #f8f8f8, #f8f8f8 10px, #f3f3f3 10px, #f3f3f3 20px)",
        border: "1.5px dashed #d1d5db", borderRadius: 8,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 4,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
        Reklama
      </span>
      <span style={{ fontSize: 11, color: "#d1d5db" }}>{label}</span>
    </div>
  );
}
