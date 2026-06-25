"use client";

import { useState, useEffect } from "react";

const MANUAL_SEARCH_SITES = [
  { label: "vouchery.sk", url: "https://www.vouchery.sk" },
  { label: "kuponovnik.sk", url: "https://www.kuponovnik.sk" },
  { label: "kuponyzdarma.sk", url: "https://www.kuponyzdarma.sk" },
];

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
      <div style={{
        width: 40, height: 40, borderRadius: "50%", margin: "0 auto 16px",
        border: "3px solid #f0f0f0", borderTopColor: "#7C3AED",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#444" }}>AI hľadá kódy pre {shopName}...</div>
      <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>Môže to trvať 10–20 sekúnd</div>
    </div>
  );

  if (error) return (
    <div style={{ background: "#fff5f5", color: "#c0392b", padding: "16px 20px", borderRadius: 12, fontSize: 14 }}>
      Chyba pri hľadaní: {error}
    </div>
  );

  if (codes.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#333", marginBottom: 6 }}>
        Nenašli sa kódy pre {shopName}
      </div>
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 24 }}>
        Tento obchod momentálne nemá dostupné promo kódy. Skús nájsť zľavy ručne:
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {MANUAL_SEARCH_SITES.map(site => (
          <a
            key={site.label}
            href={`${site.url}/?q=${encodeURIComponent(shopName)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 18px", borderRadius: 10,
              border: "1.5px solid #e0e0e0", fontSize: 13, fontWeight: 500,
              color: "#555", textDecoration: "none", background: "#fff",
            }}
          >
            {site.label} →
          </a>
        ))}
      </div>
    </div>
  );

  const promoCodes = codes.filter(c => c.type === "promo_code" || (c.code && c.code !== "AKCIA"));
  const deals = codes.filter(c => c.type === "deal" || c.code === "AKCIA");

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", marginBottom: 20 }}>
        AI nájdené zľavy ({codes.length})
      </h2>

      {promoCodes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Promo kódy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {promoCodes.map((code: any, i: number) => (
              <CouponItem key={i} code={code} copied={copied} setCopied={setCopied} />
            ))}
          </div>
        </div>
      )}

      {deals.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Aktuálne akcie
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {deals.map((code: any, i: number) => (
              <CouponItem key={i} code={code} copied={copied} setCopied={setCopied} isDeal />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CouponItem({ code, copied, setCopied, isDeal = false }: {
  code: any;
  copied: string | null;
  setCopied: (v: string | null) => void;
  isDeal?: boolean;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      border: "1px solid #eee", overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>{code.discount}</span>
          {isDeal ? (
            <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>Akcia</span>
          ) : (
            <span style={{ fontSize: 11, background: "rgba(124,58,237,0.08)", color: "#7C3AED", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>Promo kód</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>{code.description}</div>
        {code.valid_until && (
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Vyprší: {code.valid_until}</div>
        )}
      </div>
      <div style={{ padding: "12px 20px 16px" }}>
        {isDeal ? (
          <div style={{
            padding: "10px 14px", background: "#f9f9f9", borderRadius: 8,
            fontSize: 13, color: "#555", textAlign: "center",
          }}>
            Akcia aktívna – klikni na odkaz obchodu
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1, padding: "10px 14px", background: "#fafafa",
              borderRadius: 8, border: "2px dashed #7C3AED",
              fontWeight: 800, fontSize: 14, color: "#7C3AED",
              letterSpacing: 2, textAlign: "center",
            }}>
              {code.code}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code.code).catch(() => {});
                setCopied(code.code);
                setTimeout(() => setCopied(null), 2000);
              }}
              style={{
                padding: "10px 14px", borderRadius: 8,
                background: copied === code.code ? "#16a34a" : "#1d1d1f",
                color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              {copied === code.code ? "✓" : "Kopírovať"}
            </button>
          </div>
        )}
        {code.source && (
          <div style={{ fontSize: 11, color: "#ccc", marginTop: 8, textAlign: "center" }}>
            Zdroj: {code.source}
          </div>
        )}
      </div>
    </div>
  );
}
