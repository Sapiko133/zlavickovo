"use client";
import { useState } from "react";
import Image from "next/image";

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#22C55E","#D32F2F","#FF4081","#006A35","#003580"];

function colorFor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

interface Props { domain: string; name: string; size?: number; logoUrl?: string }

export default function ShopFavicon({ domain, name, size = 40, logoUrl }: Props) {
  const googleUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
  const initialStage = logoUrl ? 0 : googleUrl ? 1 : 2;
  const [stage, setStage] = useState(initialStage);

  if (stage === 2) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: colorFor(name || "?"), display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.42),
      }}>
        {(name || "?").charAt(0).toUpperCase()}
      </div>
    );
  }

  const src = stage === 0 ? logoUrl! : googleUrl!;

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      unoptimized
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 8, objectFit: "contain", flexShrink: 0 }}
      onError={() => {
        if (stage === 0 && googleUrl) setStage(1);
        else setStage(2);
      }}
    />
  );
}
