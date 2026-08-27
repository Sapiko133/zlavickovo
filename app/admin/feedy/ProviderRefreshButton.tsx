"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type FeedbackKind = "idle" | "success" | "error";

export default function ProviderRefreshButton({ provider }: { provider: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; text: string }>({ kind: "idle", text: "" });

  async function refresh() {
    if (pending) return;
    setPending(true);
    setFeedback({ kind: "idle", text: "Obnovujem…" });
    try {
      const res = await fetch("/api/admin/refresh-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: { count: number; feeds: number; status: string }; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        setFeedback({ kind: "error", text: data?.error ?? `Chyba ${res.status}` });
      } else {
        const r = data.result;
        setFeedback({
          kind: "success",
          text: r ? `Načítaných ${r.count} položiek z ${r.feeds} feedov.` : "Hotovo.",
        });
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Sieťová chyba" });
    } finally {
      setPending(false);
    }
  }

  const color = feedback.kind === "error" ? "#b91c1c" : feedback.kind === "success" ? "#166534" : "#64748b";

  return (
    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        style={{
          background: pending ? "#e2e8f0" : "#22C55E",
          border: "none",
          borderRadius: 8,
          color: pending ? "#64748b" : "#fff",
          cursor: pending ? "wait" : "pointer",
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 12px",
        }}
      >
        {pending ? "Obnovujem…" : "Obnoviť teraz"}
      </button>
      <span aria-live="polite" style={{ color, fontSize: 11, minWidth: 0 }}>
        {feedback.text}
      </span>
    </div>
  );
}
