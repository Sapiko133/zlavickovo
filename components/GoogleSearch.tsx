"use client";

export default function GoogleSearch() {
  return (
    <div style={{ margin: "32px 0" }}>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>
        🔍 Hľadaj ďalšie zľavy
      </p>
      <div className="gcse-search" />
    </div>
  );
}
