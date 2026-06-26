"use client";

import { useEffect, useState } from "react";

type Slot = "header" | "sidebar" | "between-coupons";

const SIZES: Record<Slot, { width: number; height: number; label: string }> = {
  header:             { width: 728, height: 90,  label: "728×90" },
  sidebar:            { width: 160, height: 600, label: "160×600" },
  "between-coupons":  { width: 300, height: 250, label: "300×250" },
};

interface DognetBanner {
  image_url: string;
  click_url: string;
  title?: string | null;
}

function Placeholder({ width, height, label }: { width: number; height: number; label: string }) {
  return (
    <div style={{
      width, height, maxWidth: "100%",
      background: "repeating-linear-gradient(45deg, #f8f8f8, #f8f8f8 10px, #f3f3f3 10px, #f3f3f3 20px)",
      border: "1.5px dashed #d1d5db", borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 11, color: "#d1d5db" }}>{label}</span>
    </div>
  );
}

export default function AdBanner({ slot, shopName }: { slot: Slot; shopName?: string }) {
  const adsenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
  const [banner, setBanner] = useState<DognetBanner | null | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  const effectiveSlot: Slot = isMobile && slot === "header" ? "between-coupons" : slot;
  const { width, height, label } = SIZES[effectiveSlot];

  useEffect(() => {
    if (adsenseEnabled) return;
    const params = new URLSearchParams({ width: String(width), height: String(height) });
    if (shopName) params.set("shop", shopName);
    fetch(`/api/banners?${params}`)
      .then(r => r.json())
      .then(data => setBanner(data || null))
      .catch(() => setBanner(null));
  }, [adsenseEnabled, width, height, shopName]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Reklama
      </div>
      {adsenseEnabled ? (
        <div style={{ width, height, maxWidth: "100%", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 11, color: "#d1d5db" }}>AdSense {label}</span>
        </div>
      ) : banner ? (
        <a href={banner.click_url} target="_blank" rel="nofollow noopener noreferrer" style={{ display: "inline-block" }}>
          <img src={banner.image_url} alt={banner.title || "Reklama"} width={width} height={height}
            style={{ display: "block", maxWidth: "100%", borderRadius: 8 }} />
        </a>
      ) : (
        <Placeholder width={width} height={height} label={label} />
      )}
    </div>
  );
}
