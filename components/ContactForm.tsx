"use client";

import { useState } from "react";

export default function ContactForm() {
  const [form, setForm] = useState({ company: "", email: "", website: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", fontSize: 14, borderRadius: 10,
    border: "1.5px solid #e5e7eb", outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#1d1d1f", background: "#fff",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6, display: "block" };

  if (status === "ok") {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", background: "#f0fdf4", borderRadius: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>Správa odoslaná!</div>
        <div style={{ fontSize: 14, color: "#555" }}>Ozveme sa vám do 24 hodín na {form.email}.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={labelStyle}>Názov firmy *</label>
        <input required name="company" value={form.company} onChange={handleChange} placeholder="napr. Môj E-shop s.r.o." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Email *</label>
        <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="vas@email.sk" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Web</label>
        <input name="website" value={form.website} onChange={handleChange} placeholder="https://vasweb.sk" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Správa *</label>
        <textarea required name="message" value={form.message} onChange={handleChange} rows={5}
          placeholder="Popíšte váš záujem o inzerciu alebo spoluprácu..."
          style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      {status === "error" && (
        <div style={{ color: "#dc2626", fontSize: 13 }}>Nastala chyba. Skúste prosím neskôr alebo napíšte priamo na info@zlavickovo.sk</div>
      )}
      <button type="submit" disabled={status === "sending"}
        style={{
          padding: "14px 28px", borderRadius: 12, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #7C3AED, #2563EB)", color: "#fff",
          fontWeight: 700, fontSize: 15, fontFamily: "inherit",
          opacity: status === "sending" ? 0.7 : 1,
        }}>
        {status === "sending" ? "Odosielam..." : "Odoslať dopyt →"}
      </button>
    </form>
  );
}
