"use client";

import { useState } from "react";

interface FeedEntry {
  url: string;
  domain: string;
  category: string;
}

export default function AffialFeedSection({
  initialFeeds,
  hasLoginCredentials,
}: {
  initialFeeds: FeedEntry[];
  hasLoginCredentials: boolean;
}) {
  const [feeds, setFeeds] = useState<FeedEntry[]>(initialFeeds);
  const [bulkText, setBulkText] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function discover(mode: "patterns" | "login") {
    setLoading(mode);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/affial-discover?mode=${mode}`);
      const data = await res.json();
      if (data.error) {
        setStatus({ msg: `❌ ${data.error}`, ok: false });
      } else {
        setStatus({ msg: `✓ Nájdených: ${data.found}, pridaných nových: ${data.saved}`, ok: true });
        if (data.saved > 0) window.location.reload();
      }
    } catch {
      setStatus({ msg: "❌ Sieťová chyba", ok: false });
    } finally {
      setLoading(null);
    }
  }

  async function saveBulk() {
    const urls = bulkText
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
    if (!urls.length) {
      setStatus({ msg: "Žiadne platné URL (každé na novom riadku, začína http)", ok: false });
      return;
    }
    setLoading("save");
    setStatus(null);
    try {
      const res = await fetch("/api/admin/affial-feeds-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setStatus({ msg: `✓ Pridaných ${data.saved} nových feedov z ${urls.length} URL.`, ok: true });
      setBulkText("");
      if (data.saved > 0) window.location.reload();
    } catch {
      setStatus({ msg: "❌ Chyba pri ukladaní", ok: false });
    } finally {
      setLoading(null);
    }
  }

  async function deleteFeed(url: string) {
    try {
      await fetch("/api/admin/affial-feeds-save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setFeeds((prev) => prev.filter((f) => f.url !== url));
    } catch {}
  }

  const btn = (label: string, onClick: () => void, disabled: boolean, color = "#22C55E") => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 18px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#e5e7eb" : color, color: disabled ? "#aaa" : "#fff",
        fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "opacity 0.15s",
      }}
    >
      {disabled ? "..." : label}
    </button>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: 24, marginTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>
        🔍 Affial — Objavenie feedov
      </h2>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px" }}>
        Hardcoded feedov: {feeds.length === 0 ? "iba zo zdrojového kódu" : ""} &nbsp;|&nbsp; Vlastné (Redis): <strong>{feeds.length}</strong>
      </p>

      {status && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: status.ok ? "#F0FDF4" : "#FEF2F2",
          border: `1px solid ${status.ok ? "#BBF7D0" : "#FCA5A5"}`,
          color: status.ok ? "#16A34A" : "#DC2626",
        }}>
          {status.msg}
        </div>
      )}

      {/* Auto-discover */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {btn(
          "⚡ Objaviť cez URL vzory (bez prihlásenia)",
          () => discover("patterns"),
          loading === "patterns",
        )}
        {btn(
          hasLoginCredentials ? "🔐 Prihlásiť a stiahnuť zoznam" : "🔐 Login (chýbajú env premenné)",
          () => discover("login"),
          loading === "login" || !hasLoginCredentials,
          "#6366f1",
        )}
      </div>
      <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 20px" }}>
        „URL vzory" skúša bežné Heureka feed URL pre každý obchod z AFFIAL_SHOPS bez prihlásenia.
        „Login" vyžaduje AFFIAL_EMAIL + AFFIAL_PASSWORD v .env a stáhne zoznam z panelu Affial.
      </p>

      {/* Bulk paste */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#555", display: "block", marginBottom: 6 }}>
          Manuálny import — vlož XML feed URL (každý na novom riadku):
        </label>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"https://www.example.sk/heureka/export/products.xml\nhttps://www.dalsi.cz/feed/heureka"}
          rows={5}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e8e8e8",
            fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 8 }}>
          {btn("💾 Uložiť feed URL", saveBulk, loading === "save")}
        </div>
      </div>

      {/* Current custom feeds */}
      {feeds.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#555" }}>
            Vlastné feedy v Redis ({feeds.length}):
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e8e8e8", borderRadius: 8 }}>
            {feeds.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderBottom: i < feeds.length - 1 ? "1px solid #f5f5f5" : undefined,
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 700, minWidth: 140, color: "#1d1d1f" }}>{f.domain}</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: "#666", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.url}
                </a>
                <button
                  onClick={() => deleteFeed(f.url)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
