"use client";

import { useState } from "react";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";

const AFFIAL_AID = "a_aid=6202d95ce406b";
const EHUB_AID   = "a_aid=85c7b80f";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#15803d" : "#b91c1c",
    }}>{ok ? "✅" : "❌"} {label}</span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 14px", padding: "10px 16px", background: "#f3f4f6", borderRadius: 8, borderLeft: "4px solid #22C55E" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AdminTestPage() {
  const [dognetResult, setDognetResult]   = useState<any[] | null>(null);
  const [dognetLoading, setDognetLoading] = useState(false);
  const [dognetError, setDognetError]     = useState<string | null>(null);

  const [ehubResult, setEhubResult]       = useState<{ shops: number; coupons: number } | null>(null);
  const [ehubLoading, setEhubLoading]     = useState(false);

  const [clickLog, setClickLog]           = useState<string | null>(null);

  const [reveals, setReveals]             = useState<any[] | null>(null);
  const [revealsLoading, setRevealsLoading] = useState(false);

  async function testDognet() {
    setDognetLoading(true);
    setDognetError(null);
    try {
      const res = await fetch("/api/admin/diagnostic");
      const data = await res.json();
      setDognetResult((data.coupons || []).slice(0, 5));
      if (data.total !== undefined) {
        setDognetError(null);
        // Store total count for display
        (window as any).__dognetTotal = data.total;
      }
    } catch (e: any) {
      setDognetError(e.message);
    } finally {
      setDognetLoading(false);
    }
  }

  async function loadReveals() {
    setRevealsLoading(true);
    try {
      const res = await fetch("/api/admin/diagnostic?source=recent");
      const data = await res.json();
      setReveals(data.reveals || []);
    } finally {
      setRevealsLoading(false);
    }
  }

  async function testEhub() {
    setEhubLoading(true);
    try {
      const res = await fetch("/api/admin/diagnostic?source=ehub");
      const data = await res.json();
      setEhubResult({ shops: data.shops ?? 0, coupons: data.coupons_count ?? 0 });
    } finally {
      setEhubLoading(false);
    }
  }

  function testClick(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setClickLog(url);
  }

  const affialFail = AFFIAL_SHOPS.filter(s => {
    const isEhub = s.affiliateUrl.includes("ehub.cz");
    return !(s.affiliateUrl.includes(AFFIAL_AID) || (isEhub && s.affiliateUrl.includes(EHUB_AID)));
  });
  const affialOk = AFFIAL_SHOPS.filter(s => {
    const isEhub = s.affiliateUrl.includes("ehub.cz");
    return s.affiliateUrl.includes(AFFIAL_AID) || (isEhub && s.affiliateUrl.includes(EHUB_AID));
  });

  const TEST_COUPON = {
    shop: "Vimax.sk",
    code: "ZLAVA10",
    discount: "10%",
    affiliateUrl: AFFIAL_SHOPS.find(s => s.domain === "vimax.sk")?.affiliateUrl ?? "#",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🧪 Test stránka</span>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>Diagnostika affiliate linkov a kupónov</span>
      </div>

      <div style={{ maxWidth: 960, margin: "32px auto", padding: "0 24px" }}>

        {/* ── 1. AFFIAL SHOPS ── */}
        <Section title="1. AFFIAL_SHOPS — tracking parameter">
          <div style={{ marginBottom: 10, display: "flex", gap: 12, alignItems: "center" }}>
            <Badge ok={affialFail.length === 0} label={`${affialOk.length}/${AFFIAL_SHOPS.length} OK`} />
            {affialFail.length > 0 && (
              <span style={{ fontSize: 12, color: "#b91c1c" }}>{affialFail.length} chýba tracking</span>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Obchod</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Domain</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>affiliateUrl</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {AFFIAL_SHOPS.map((shop, i) => {
                const isEhub = shop.affiliateUrl.includes("ehub.cz");
                const hasAid = shop.affiliateUrl.includes(AFFIAL_AID) || (isEhub && shop.affiliateUrl.includes(EHUB_AID));
                return (
                  <tr key={shop.domain} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600 }}>{shop.name}</td>
                    <td style={{ padding: "7px 12px", color: "#6b7280" }}>{shop.domain}</td>
                    <td style={{ padding: "7px 12px", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <a href={shop.affiliateUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none", fontSize: 11 }}>
                        {shop.affiliateUrl.length > 60 ? shop.affiliateUrl.slice(0, 60) + "…" : shop.affiliateUrl}
                      </a>
                    </td>
                    <td style={{ padding: "7px 12px", textAlign: "center" }}>
                      <Badge ok={hasAid} label={hasAid ? "tracking OK" : "chýba a_aid"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* ── 2. DOGNET ── */}
        <Section title="2. Dognet — affiliate_link v kupónoch">
          <button
            onClick={testDognet}
            disabled={dognetLoading}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#22C55E", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: dognetLoading ? "not-allowed" : "pointer",
              marginBottom: 16, opacity: dognetLoading ? 0.7 : 1,
            }}
          >
            {dognetLoading ? "Načítavam…" : "🔄 Načítať Dognet kupóny"}
          </button>
          {dognetError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
              ❌ {dognetError}
            </div>
          )}
          {dognetResult && (
            dognetResult.length === 0 ? (
              <div style={{ padding: "10px 14px", background: "#fef9c3", borderRadius: 8, color: "#92400e", fontSize: 13 }}>
                ⚠️ API vrátilo 0 kupónov
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Obchod</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Kód</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Title</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>affiliate_link</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dognetResult.map((c: any, i: number) => {
                    const link = c.affiliate_link || c.url || "";
                    const isTracking = link.includes("go.dognet.com") || link.includes("dognet");
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "7px 12px", fontWeight: 600 }}>{c.campaign?.name || "—"}</td>
                        <td style={{ padding: "7px 12px", fontFamily: "monospace" }}>{c.code || "—"}</td>
                        <td style={{ padding: "7px 12px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "—"}</td>
                        <td style={{ padding: "7px 12px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none", fontSize: 11 }}>
                            {link.length > 50 ? link.slice(0, 50) + "…" : link || "—"}
                          </a>
                        </td>
                        <td style={{ padding: "7px 12px", textAlign: "center" }}>
                          <Badge ok={isTracking} label={isTracking ? "go.dognet.com" : "priama URL"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </Section>

        {/* ── 3. EHUB ── */}
        <Section title="3. eHub — obchody a kupóny">
          <button
            onClick={testEhub}
            disabled={ehubLoading}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#2563eb", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: ehubLoading ? "not-allowed" : "pointer",
              marginBottom: 16, opacity: ehubLoading ? 0.7 : 1,
            }}
          >
            {ehubLoading ? "Načítavam…" : "🔄 Načítať eHub"}
          </button>
          {ehubResult && (
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ padding: "16px 24px", background: "#eff6ff", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>{ehubResult.shops}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Obchody (kampane)</div>
              </div>
              <div style={{ padding: "16px 24px", background: "#f0fdf4", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#15803d" }}>{ehubResult.coupons}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Kupóny (vouchery)</div>
              </div>
            </div>
          )}
        </Section>

        {/* ── 4. KLIKNUTIE TEST ── */}
        <Section title="4. Test kliknutia na kupón">
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", maxWidth: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{TEST_COUPON.shop}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Kód: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{TEST_COUPON.code}</code> · Zľava: {TEST_COUPON.discount}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 16, wordBreak: "break-all" }}>
              URL: <span style={{ color: "#374151" }}>{TEST_COUPON.affiliateUrl}</span>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); testClick(TEST_COUPON.affiliateUrl); }}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              Získať kód →
            </button>
            {clickLog && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 4 }}>✅ Otvorilo sa:</div>
                <div style={{ wordBreak: "break-all", color: "#374151" }}>{clickLog}</div>
                <Badge ok={clickLog.includes("a_aid=") || clickLog.includes("utm_source")} label={clickLog.includes("a_aid=") || clickLog.includes("utm_source") ? "tracking OK" : "chýba tracking"} />
              </div>
            )}
          </div>
        </Section>

        {/* ── 5. RECENT REVEALS ── */}
        <Section title="5. Posledných 10 kupónov zobrazených používateľom">
          <button
            onClick={loadReveals}
            disabled={revealsLoading}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#7c3aed", color: "#fff", fontWeight: 700,
              fontSize: 13, cursor: revealsLoading ? "not-allowed" : "pointer",
              marginBottom: 16, opacity: revealsLoading ? 0.7 : 1,
            }}
          >
            {revealsLoading ? "Načítavam…" : "🔄 Načítať posledné kupóny"}
          </button>
          {reveals !== null && (
            reveals.length === 0 ? (
              <div style={{ padding: "10px 14px", background: "#fef9c3", borderRadius: 8, color: "#92400e", fontSize: 13 }}>
                ⚠️ Žiadne záznamy — kupóny sa ešte nezobrazia (Redis prázdny)
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Čas</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Obchod</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Kód</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>affiliate_link</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {reveals.map((r: any, i: number) => {
                    const link = r.affiliate_link || "";
                    const hasTracking = link.includes("go.dognet.com") || link.includes("a_aid=6202d95ce406b") || link.includes("ehub.cz");
                    const time = r.ts ? new Date(r.ts).toLocaleTimeString("sk-SK") : "—";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "7px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{time}</td>
                        <td style={{ padding: "7px 12px", fontWeight: 600 }}>{r.shop || "—"}</td>
                        <td style={{ padding: "7px 12px", fontFamily: "monospace" }}>{r.code || "—"}</td>
                        <td style={{ padding: "7px 12px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none", fontSize: 11 }}>
                              {link.length > 55 ? link.slice(0, 55) + "…" : link}
                            </a>
                          ) : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={{ padding: "7px 12px", textAlign: "center" }}>
                          <Badge ok={hasTracking} label={hasTracking ? "tracking OK" : "chýba tracking"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </Section>

      </div>
    </div>
  );
}
