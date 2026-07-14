"use client";

import { useState } from "react";

interface Props {
  productUrl: string;
  currency?: "EUR" | "CZK";
}

const GREEN = "#22C55E";

/**
 * Sledovanie ceny (§16/§10.8). Používateľ zadá email + cieľovú cenu; upozornenie
 * príde emailom, keď cena klesne. Collapsed → button, po kliknutí formulár.
 */
export default function PriceWatchForm({ productUrl, currency = "EUR" }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const symbol = currency === "CZK" ? "Kč" : "€";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(target.replace(",", "."));
    if (!email.includes("@") || !Number.isFinite(price) || price <= 0) {
      setState("error");
      setMsg("Zadaj platný email a cieľovú cenu.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/price-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productUrl, targetPrice: price }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setState("ok");
        setMsg(`Hotovo! Upozorníme ťa emailom, keď cena klesne na ${target} ${symbol} alebo nižšie.`);
      } else {
        setState("error");
        setMsg(data.error === "product_not_found" ? "Produkt sa nenašiel." : "Nepodarilo sa uložiť sledovanie.");
      }
    } catch {
      setState("error");
      setMsg("Chyba spojenia. Skús to prosím znova.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, background: "#fff",
          border: `1.5px solid ${GREEN}`, color: "#15803d", borderRadius: 12,
          padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer",
          marginBottom: 24,
        }}
      >
        🔔 Sledovať cenu
      </button>
    );
  }

  return (
    <div style={{
      background: "#f0fdf4", border: `1.5px solid #bbf7d0`, borderRadius: 14,
      padding: "16px 18px", marginBottom: 24, maxWidth: 560,
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#15803d", marginBottom: 10 }}>
        🔔 Sledovať cenu — dáme ti vedieť, keď klesne
      </div>
      {state === "ok" ? (
        <div style={{ fontSize: 13, color: "#15803d", lineHeight: 1.5 }}>{msg}</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email" inputMode="email" placeholder="tvoj@email.sk" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>Upozorni ma keď cena klesne na</span>
            <input
              type="text" inputMode="decimal" placeholder="0,00" value={target}
              onChange={(e) => setTarget(e.target.value)} required
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, width: 90 }}
            />
            <span style={{ fontSize: 14, color: "#374151" }}>{symbol}</span>
          </div>
          {state === "error" && <div style={{ fontSize: 12, color: "#dc2626" }}>{msg}</div>}
          <button
            type="submit" disabled={state === "sending"}
            style={{
              background: GREEN, color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer",
              opacity: state === "sending" ? 0.7 : 1,
            }}
          >
            {state === "sending" ? "Ukladám…" : "Sledovať cenu"}
          </button>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            Pošleme ti jeden email, keď cena klesne. Odhlásiť sa dá kedykoľvek jedným klikom.
          </div>
        </form>
      )}
    </div>
  );
}
