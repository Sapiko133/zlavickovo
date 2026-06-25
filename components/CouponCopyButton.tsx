"use client";

import { useState } from "react";

export default function CouponCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "10px 14px", borderRadius: 8,
        background: copied ? "#16a34a" : "#1d1d1f",
        color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓" : "Kopírovať"}
    </button>
  );
}
