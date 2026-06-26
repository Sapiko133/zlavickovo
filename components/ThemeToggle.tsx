"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: 32, height: 32 }} />;

  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Prepnúť na svetlý mód" : "Prepnúť na tmavý mód"}
      style={{
        width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
        background: "var(--bg2)", cursor: "pointer", fontSize: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
