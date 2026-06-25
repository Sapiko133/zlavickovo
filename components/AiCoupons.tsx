"use client";

import { useState, useEffect } from "react";

export default function AiCoupons({ shopName }: { shopName: string }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopName, country: "sk" }),
    })
      .then(r => r.json())
      .then(data => {
        setCodes(data.codes || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [shopName]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>AI hľadá kódy pre {shopName}...</div>
      <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>Môže to trvať 10-20 sekúnd</div>
    </div>
  );

  if (error) return (
    <div style={{ background: "#fff0f0", color: "#E8001D", padding: 20, borderRadius: 12 }}>
      ⚠️ {error}
    </div>
  );

  if (codes.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>😔</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Nenašli sa žiadne kódy pre {shopName}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 20 }}>
        🤖 AI nájdené kódy ({codes.length})
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {codes.map((code: any, i: number) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #eee", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{code.discount}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{code.description}</div>
              {code.valid_until && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Vyprší: {code.valid_until}</div>
              )}
            </div>
            <div style={{ padding: "12px 20px 16px" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, padding: "10px 14px", background: "#f7f7f7", borderRadius: 8, border: "2px dashed #E8001D", fontWeight: 800, fontSize: 14, color: "#E8001D", letterSpacing: 2, textAlign: "center" }}>
                  {code.code}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(code.code).catch(() => {});
                    setCopied(code.code);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  style={{ padding: "10px 14px", borderRadius: 8, background: copied === code.code ? "#00A551" : "#1a1a2e", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {copied === code.code ? "✓" : "Kopírovať"}
                </button>
              </div>
              {code.source && (
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 8, textAlign: "center" }}>
                  Zdroj: {code.source}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}