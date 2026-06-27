"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";

const CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

interface ShopEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

const TOP_SHOPS: ShopEntry[] = [
  { name: "Alza",         slug: "alza",         category: "Elektronika", domain: "alza.sk" },
  { name: "Mall",         slug: "mall",         category: "Elektronika", domain: "mall.sk" },
  { name: "Datart",       slug: "datart",       category: "Elektronika", domain: "datart.sk" },
  { name: "NAY",          slug: "nay",          category: "Elektronika", domain: "nay.sk" },
  { name: "Okay.sk",      slug: "okay",         category: "Elektronika", domain: "okay.sk" },
  { name: "Samsung",      slug: "samsung",      category: "Elektronika", domain: "samsung.com" },
  { name: "Zalando",      slug: "zalando",      category: "Móda",        domain: "zalando.sk" },
  { name: "Shein",        slug: "shein",        category: "Móda",        domain: "shein.com" },
  { name: "ASOS",         slug: "asos",         category: "Móda",        domain: "asos.com" },
  { name: "About You",    slug: "about-you",    category: "Móda",        domain: "aboutyou.sk" },
  { name: "Answear",      slug: "answear",      category: "Móda",        domain: "answear.sk" },
  { name: "Zara",         slug: "zara",         category: "Móda",        domain: "zara.com" },
  { name: "H&M",          slug: "hm",           category: "Móda",        domain: "hm.com" },
  { name: "Dedoles",      slug: "dedoles",      category: "Móda",        domain: "dedoles.sk" },
  { name: "Notino",       slug: "notino",       category: "Krása",       domain: "notino.sk" },
  { name: "GymBeam",      slug: "gymbeam",      category: "Zdravie",     domain: "gymbeam.sk" },
  { name: "Dr. Max",      slug: "dr-max",       category: "Zdravie",     domain: "drmax.sk" },
  { name: "Herbatica",    slug: "herbatica",    category: "Zdravie",     domain: "herbatica.sk" },
  { name: "Sportisimo",   slug: "sportisimo",   category: "Šport",       domain: "sportisimo.sk" },
  { name: "Decathlon",    slug: "decathlon",    category: "Šport",       domain: "decathlon.sk" },
  { name: "Nike",         slug: "nike",         category: "Šport",       domain: "nike.com" },
  { name: "Adidas",       slug: "adidas",       category: "Šport",       domain: "adidas.com" },
  { name: "IKEA",         slug: "ikea",         category: "Bývanie",     domain: "ikea.com" },
  { name: "Martinus",     slug: "martinus",     category: "Knihy",       domain: "martinus.sk" },
  { name: "Panta Rhei",   slug: "panta-rhei",   category: "Knihy",       domain: "pantarhei.sk" },
  { name: "Booking.com",  slug: "booking-com",  category: "Cestovanie",  domain: "booking.com" },
  { name: "Airbnb",       slug: "airbnb",       category: "Cestovanie",  domain: "airbnb.com" },
  { name: "Invia",        slug: "invia",        category: "Cestovanie",  domain: "invia.sk" },
  { name: "Lidl",         slug: "lidl",         category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",     slug: "kaufland",     category: "Potraviny",   domain: "kaufland.sk" },
  { name: "Tesco",        slug: "tesco",        category: "Potraviny",   domain: "tesco.sk" },
  { name: "Billa",        slug: "billa",        category: "Potraviny",   domain: "billa.sk" },
  { name: "Rohlik.sk",    slug: "rohlik",       category: "Potraviny",   domain: "rohlik.cz" },
  { name: "Lenovo",       slug: "lenovo",       category: "Elektronika", domain: "lenovo.com" },
];

function buildAffialEntries(): ShopEntry[] {
  return AFFIAL_SHOPS.map(s => ({
    name: s.name,
    slug: s.domain.replace(".", "-"),
    category: CAT_LABELS[s.category] ?? "Iné",
    domain: s.domain,
  }));
}

const AFFIAL_ENTRIES = buildAffialEntries();

// Merge and deduplicate by lowercase slug
function mergeShops(base: ShopEntry[], extra: ShopEntry[]): ShopEntry[] {
  const seen = new Set(base.map(s => s.slug.toLowerCase()));
  return [...base, ...extra.filter(s => !seen.has(s.slug.toLowerCase()))];
}

type SearchMode = "shop" | "url";

function ShopLogo({ domain, name, size = 32 }: { domain: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const bg = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#7C3AED", "#D32F2F", "#FF4081", "#0ea5e9"][
    name.charCodeAt(0) % 8
  ];

  if (!domain || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 800, fontSize: size * 0.45,
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 8, objectFit: "contain", flexShrink: 0, background: "#f5f5f5" }}
    />
  );
}

export default function SearchBar() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("shop");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [ehubShops, setEhubShops] = useState<ShopEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch eHub shops once on mount
  useEffect(() => {
    fetch("/api/shops-list")
      .then(r => r.json())
      .then((data: ShopEntry[]) => setEhubShops(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const allShops = useMemo(
    () => mergeShops(mergeShops(TOP_SHOPS, AFFIAL_ENTRIES), ehubShops),
    [ehubShops]
  );

  const suggestions = useMemo(() => {
    if (mode !== "shop" || query.length < 2) return [];
    const lq = query.toLowerCase();
    return allShops
      .filter(s => s.name.toLowerCase().includes(lq))
      .slice(0, 8);
  }, [query, mode, allShops]);

  // Reset highlight when suggestions change
  useEffect(() => { setHighlight(-1); }, [suggestions]);

  // Show/hide dropdown
  useEffect(() => {
    setOpen(suggestions.length > 0);
  }, [suggestions]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const navigate = useCallback((shop: ShopEntry) => {
    setOpen(false);
    setQuery(shop.name);
    router.push(`/kupony/${shop.slug}`);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && e.key !== "Enter") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && suggestions[highlight]) {
        navigate(suggestions[highlight]);
      } else if (mode === "shop" && suggestions.length > 0) {
        navigate(suggestions[0]);
      } else if (mode === "shop" && query.trim()) {
        setOpen(false);
        router.push(`/kupony/${query.trim().toLowerCase().replace(/\s+/g, "-")}`);
      } else if (mode === "url" && query.trim()) {
        setOpen(false);
        router.push("/hladat?q=" + encodeURIComponent(query.trim()));
      }
    }
  }

  const modes: { key: SearchMode; label: string }[] = [
    { key: "shop", label: "🏪 Obchod" },
    { key: "url",  label: "🔗 URL / kód" },
  ];

  const placeholders: Record<SearchMode, string> = {
    shop: "Napr. Alza, Shein, Zalando...",
    url:  "Vlož link produktu alebo kód...",
  };

  return (
    <div ref={containerRef} style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
      {/* Mode tabs */}
      <div style={{ display: "inline-flex", background: "#f0f0f0", borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setQuery(""); setOpen(false); }}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, transition: "all 0.12s",
              background: mode === m.key ? "#fff" : "transparent",
              color: mode === m.key ? "#1d1d1f" : "#888",
              boxShadow: mode === m.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              fontFamily: "inherit",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div style={{
        display: "flex", position: "relative",
        background: "#fff", borderRadius: 14,
        border: `2px solid ${open ? "#22C55E" : "#e8e8e8"}`,
        boxShadow: open ? "0 0 0 4px rgba(34,197,94,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        overflow: "visible",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[mode]}
          autoComplete="off"
          style={{
            flex: 1, padding: "16px 20px", borderRadius: "12px 0 0 12px",
            border: "none", background: "transparent",
            color: "#1d1d1f", fontSize: 15, outline: "none",
            boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{
              padding: "0 10px", border: "none", background: "transparent",
              color: "#bbb", cursor: "pointer", fontSize: 18, flexShrink: 0,
            }}
            tabIndex={-1}
            aria-label="Vymazať"
          >
            ×
          </button>
        )}
        <button
          onClick={() => {
            if (mode === "shop") {
              if (suggestions.length > 0) navigate(suggestions[highlight >= 0 ? highlight : 0]);
              else if (query.trim()) router.push(`/kupony/${query.trim().toLowerCase().replace(/\s+/g, "-")}`);
            } else {
              if (query.trim()) router.push("/hladat?q=" + encodeURIComponent(query.trim()));
            }
          }}
          style={{
            padding: "16px 28px", borderRadius: "0 12px 12px 0", border: "none",
            background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#16A34A")}
          onMouseLeave={e => (e.currentTarget.style.background = "#22C55E")}
        >
          Hľadať
        </button>

        {/* Dropdown */}
        {open && suggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
            background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            zIndex: 300, overflow: "hidden",
          }}>
            {suggestions.map((shop, i) => (
              <div
                key={`${shop.slug}-${i}`}
                onMouseDown={e => { e.preventDefault(); navigate(shop); }}
                onMouseEnter={() => setHighlight(i)}
                onMouseLeave={() => setHighlight(-1)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "0 16px", height: 48, cursor: "pointer",
                  background: highlight === i ? "#F0FDF4" : "#fff",
                  borderBottom: i < suggestions.length - 1 ? "1px solid #f5f5f5" : "none",
                  transition: "background 0.1s",
                }}
              >
                <ShopLogo domain={shop.domain} name={shop.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {shop.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                    {shop.category}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#bbb", flexShrink: 0 }}>
                  kupóny →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
