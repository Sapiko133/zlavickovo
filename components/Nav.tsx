"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import ShopFavicon from "@/components/ShopFavicon";

const CAT_LIST = [
  { slug: "elektronika", label: "Elektronika", emoji: "💻" },
  { slug: "moda",        label: "Móda",        emoji: "👗" },
  { slug: "zdravie",     label: "Zdravie",     emoji: "💊" },
  { slug: "krasa",       label: "Krása",       emoji: "💄" },
  { slug: "sport",       label: "Šport",       emoji: "⚽" },
  { slug: "byvanie",     label: "Bývanie",     emoji: "🏠" },
  { slug: "potraviny",   label: "Potraviny",   emoji: "🛒" },
  { slug: "deti",        label: "Deti",        emoji: "👶" },
  { slug: "cestovanie",  label: "Cestovanie",  emoji: "✈️" },
  { slug: "knihy",       label: "Knihy",       emoji: "📚" },
];

const NAV_LINKS = [
  { label: "Obchody", href: "/obchody" },
  { label: "Kupóny",  href: "/kupony" },
  { label: "Akcie",   href: "/akcie" },
  { label: "Letáky",  href: "/letaky" },
];

const CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

interface ShopEntry { name: string; slug: string; category: string; domain: string }

const TOP_SHOPS: ShopEntry[] = [
  { name: "Alza",       slug: "alza",       category: "Elektronika", domain: "alza.sk" },
  { name: "Mall",       slug: "mall",       category: "Elektronika", domain: "mall.sk" },
  { name: "Datart",     slug: "datart",     category: "Elektronika", domain: "datart.sk" },
  { name: "Zalando",    slug: "zalando",    category: "Móda",        domain: "zalando.sk" },
  { name: "Shein",      slug: "shein",      category: "Móda",        domain: "shein.com" },
  { name: "Notino",     slug: "notino",     category: "Krása",       domain: "notino.sk" },
  { name: "GymBeam",    slug: "gymbeam",    category: "Zdravie",     domain: "gymbeam.sk" },
  { name: "Dr. Max",    slug: "dr-max",     category: "Zdravie",     domain: "drmax.sk" },
  { name: "Sportisimo", slug: "sportisimo", category: "Šport",       domain: "sportisimo.sk" },
  { name: "Decathlon",  slug: "decathlon",  category: "Šport",       domain: "decathlon.sk" },
  { name: "IKEA",       slug: "ikea",       category: "Bývanie",     domain: "ikea.com" },
  { name: "Martinus",   slug: "martinus",   category: "Knihy",       domain: "martinus.sk" },
  { name: "Lidl",       slug: "lidl",       category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",   slug: "kaufland",   category: "Potraviny",   domain: "kaufland.sk" },
  { name: "About You",  slug: "about-you",  category: "Móda",        domain: "aboutyou.sk" },
  { name: "ZOOT",       slug: "zoot",       category: "Móda",        domain: "zoot.sk" },
  { name: "Herbatica",  slug: "herbatica",  category: "Zdravie",     domain: "herbatica.sk" },
  { name: "Dedoles",    slug: "dedoles",    category: "Móda",        domain: "dedoles.sk" },
  { name: "Temu",       slug: "temu",       category: "Iné",         domain: "temu.com" },
  { name: "Nike",       slug: "nike",       category: "Šport",       domain: "nike.com" },
  { name: "Adidas",     slug: "adidas",     category: "Šport",       domain: "adidas.com" },
];

function buildAffialEntries(): ShopEntry[] {
  return AFFIAL_SHOPS.map(s => ({
    name: s.name,
    slug: s.domain.replace(/\.(sk|cz|eu|com)$/, "").replace(/\./g, "-"),
    category: CAT_LABELS[s.category] ?? "Iné",
    domain: s.domain,
  }));
}
const AFFIAL_ENTRIES = buildAffialEntries();

function mergeShops(base: ShopEntry[], extra: ShopEntry[]): ShopEntry[] {
  const seen = new Set(base.map(s => s.slug));
  return [...base, ...extra.filter(s => !seen.has(s.slug))];
}
const ALL_LOCAL_SHOPS = mergeShops(TOP_SHOPS, AFFIAL_ENTRIES);

function filterShops(shops: ShopEntry[], q: string): ShopEntry[] {
  const lq = q.toLowerCase();
  const matches = shops.filter(s => s.name.toLowerCase().includes(lq));
  matches.sort((a, b) => {
    const aS = a.name.toLowerCase().startsWith(lq) ? 0 : 1;
    const bS = b.name.toLowerCase().startsWith(lq) ? 0 : 1;
    return aS - bS;
  });
  return matches.slice(0, 6);
}

function CatDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 10px)", left: "50%",
      transform: "translateX(-50%)", zIndex: 500,
      background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.12)", padding: "8px", minWidth: 220,
    }}>
      {CAT_LIST.map(c => (
        <a key={c.slug} href={`/kategoria/${c.slug}`} onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "#222", textDecoration: "none", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{c.emoji}</span>
          {c.label}
        </a>
      ))}
      <div style={{ borderTop: "1px solid #f0f0f0", margin: "6px 0" }} />
      <a href="/kategoria" onClick={onClose}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "#22C55E", textDecoration: "none", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        🗂️ Všetky kategórie →
      </a>
    </div>
  );
}

export default function Nav() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dynamicShops, setDynamicShops] = useState<ShopEntry[]>([]);

  const catRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/autocomplete")
      .then(r => r.json())
      .then((d: ShopEntry[]) => setDynamicShops(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const allShops = mergeShops(ALL_LOCAL_SHOPS, dynamicShops);

  const suggestions = query.length >= 1 ? filterShops(allShops, query) : [];

  useEffect(() => { setHighlight(-1); }, [query]);
  useEffect(() => { setDropOpen(suggestions.length > 0); }, [suggestions]);

  useEffect(() => {
    if (!catOpen) return;
    function h(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [catOpen]);

  useEffect(() => {
    if (!dropOpen) return;
    function h(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const goShop = useCallback((shop: ShopEntry) => {
    setDropOpen(false); setQuery(shop.name);
    router.push(`/kupony/${shop.slug}`);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => h <= 0 ? suggestions.length - 1 : h - 1); }
    else if (e.key === "Escape") { setDropOpen(false); setHighlight(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) { goShop(suggestions[highlight]); }
      else if (suggestions.length > 0) { goShop(suggestions[0]); }
      else if (query.trim()) { setDropOpen(false); router.push("/hladat?q=" + encodeURIComponent(query.trim())); }
    }
  }

  return (
    <>
      <style>{`
        .nav-link { color:#444;text-decoration:none;font-size:14px;font-weight:500;padding:4px 0;white-space:nowrap;border-bottom:2px solid transparent;transition:color .15s,border-color .15s; }
        .nav-link:hover { color:#22C55E;border-bottom-color:#22C55E; }
        .nav-cat-btn { background:none;border:none;cursor:pointer;color:#444;font-size:14px;font-weight:500;padding:4px 0;white-space:nowrap;border-bottom:2px solid transparent;font-family:inherit;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:4px;line-height:1; }
        .nav-cat-btn:hover,.nav-cat-btn.open { color:#22C55E;border-bottom-color:#22C55E; }
        .nav-search-drop-item:hover { background:#F0FDF4 !important; }
        @media(max-width:900px) { .nav-links-desktop{display:none!important} .nav-search-wrap{display:none!important} .nav-hamburger{display:flex!important} }
        @media(max-width:1100px) { .nav-search-wrap{max-width:240px!important} }
      `}</style>

      <nav style={{ display:"flex", alignItems:"center", gap:16, padding:"0 20px", height:60, background:"#fff", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, zIndex:300, fontFamily:"system-ui,-apple-system,sans-serif", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* Logo */}
        <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", flexShrink:0, marginRight:12 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"#22C55E", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15, fontWeight:900 }}>Z</div>
          <span style={{ fontWeight:800, fontSize:16, color:"#1d1d1f", letterSpacing:"-0.3px", whiteSpace:"nowrap" }}>
            Zlavickovo<span style={{ color:"#22C55E" }}>.sk</span>
          </span>
        </a>

        {/* Search — center */}
        <div className="nav-search-wrap" ref={searchRef} style={{ flex:1, maxWidth:380, position:"relative" }}>
          <div style={{ display:"flex", border:`1.5px solid ${dropOpen ? "#22C55E" : "#e0e0e0"}`, borderRadius:10, background:"#f9fafb", transition:"border-color .15s,box-shadow .15s", boxShadow: dropOpen ? "0 0 0 3px rgba(34,197,94,0.10)" : "none" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
              onFocus={() => { if (suggestions.length > 0) setDropOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Hľadaj obchod alebo produkt..."
              autoComplete="off"
              style={{ flex:1, padding:"9px 14px", border:"none", background:"transparent", fontSize:14, color:"#1d1d1f", outline:"none", fontFamily:"inherit" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setDropOpen(false); inputRef.current?.focus(); }}
                tabIndex={-1}
                style={{ padding:"0 8px", border:"none", background:"transparent", color:"#bbb", cursor:"pointer", fontSize:16, lineHeight:1 }}
              >×</button>
            )}
            <button
              onClick={() => {
                if (suggestions.length > 0) goShop(suggestions[highlight >= 0 ? highlight : 0]);
                else if (query.trim()) router.push("/hladat?q=" + encodeURIComponent(query.trim()));
              }}
              style={{ padding:"8px 14px", border:"none", borderRadius:"0 8px 8px 0", background:"#22C55E", color:"#fff", cursor:"pointer", fontSize:15, fontFamily:"inherit", fontWeight:700, flexShrink:0 }}
              aria-label="Hľadať"
            >🔍</button>
          </div>

          {/* Dropdown */}
          {dropOpen && suggestions.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1px solid #e8e8e8", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:400, overflow:"hidden" }}>
              {suggestions.map((shop, i) => (
                <div key={shop.slug}
                  className="nav-search-drop-item"
                  onMouseDown={e => { e.preventDefault(); goShop(shop); }}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", cursor:"pointer", background: highlight === i ? "#F0FDF4" : "#fff", borderBottom: i < suggestions.length - 1 ? "1px solid #f5f5f5" : "none" }}
                >
                  <ShopFavicon domain={shop.domain || ""} name={shop.name} size={28} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1d1d1f", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shop.name}</div>
                    <div style={{ fontSize:11, color:"#999" }}>{shop.category}</div>
                  </div>
                  <span style={{ fontSize:11, color:"#ccc" }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop nav links */}
        <div className="nav-links-desktop" style={{ display:"flex", alignItems:"center", gap:24, flexShrink:0 }}>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
          <div ref={catRef} style={{ position:"relative", display:"flex", alignItems:"center" }}>
            <button className={`nav-cat-btn${catOpen ? " open" : ""}`} onClick={() => setCatOpen(o => !o)} aria-expanded={catOpen}>
              Kategórie <span style={{ fontSize:10, opacity:0.7 }}>{catOpen ? "▲" : "▼"}</span>
            </button>
            {catOpen && <CatDropdown onClose={() => setCatOpen(false)} />}
          </div>
        </div>

        {/* Right */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto", flexShrink:0 }}>
          <LanguageSwitcher />
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? "Zavrieť menu" : "Otvoriť menu"}
            aria-expanded={menuOpen}
            style={{ display:"none", background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#1d1d1f", padding:"6px", lineHeight:1, minWidth:44, minHeight:44, alignItems:"center", justifyContent:"center" }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile fullscreen menu */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:500, background:"#fff", overflowY:"auto", display:"flex", flexDirection:"column", fontFamily:"system-ui,-apple-system,sans-serif" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", height:60, flexShrink:0, borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
            <a href="/" onClick={() => setMenuOpen(false)} style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
              <div style={{ width:30, height:30, borderRadius:8, background:"#22C55E", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15, fontWeight:900 }}>Z</div>
              <span style={{ fontWeight:800, fontSize:16, color:"#1d1d1f" }}>Zlavickovo<span style={{ color:"#22C55E" }}>.sk</span></span>
            </a>
            <button onClick={() => setMenuOpen(false)} aria-label="Zavrieť" style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#1d1d1f", padding:"6px", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>

          {/* Mobile search */}
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #f0f0f0" }}>
            <form onSubmit={e => { e.preventDefault(); const v = query.trim(); if (v) { setMenuOpen(false); router.push("/hladat?q=" + encodeURIComponent(v)); } }}>
              <div style={{ display:"flex", border:"1.5px solid #e0e0e0", borderRadius:10, background:"#f9fafb", overflow:"hidden" }}>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Hľadaj obchod alebo produkt..." style={{ flex:1, padding:"10px 14px", border:"none", background:"transparent", fontSize:15, color:"#1d1d1f", outline:"none", fontFamily:"inherit" }} />
                <button type="submit" style={{ padding:"10px 16px", border:"none", background:"#22C55E", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:15, fontFamily:"inherit" }}>🔍</button>
              </div>
            </form>
          </div>

          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              style={{ display:"flex", alignItems:"center", padding:"0 20px", minHeight:52, color:"#1d1d1f", textDecoration:"none", fontSize:16, fontWeight:600, borderBottom:"1px solid #f5f5f5" }}
            >{l.label}</a>
          ))}

          <div style={{ padding:"16px 20px 8px", fontSize:11, fontWeight:700, color:"#aaa", letterSpacing:"0.08em", textTransform:"uppercase" }}>Kategórie</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
            {CAT_LIST.map(c => (
              <a key={c.slug} href={`/kategoria/${c.slug}`} onClick={() => setMenuOpen(false)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"0 20px", minHeight:48, color:"#444", textDecoration:"none", fontSize:14, fontWeight:500, borderBottom:"1px solid #f5f5f5" }}
              >
                <span style={{ fontSize:20 }}>{c.emoji}</span> {c.label}
              </a>
            ))}
          </div>
          <div style={{ padding:"16px 20px" }}><LanguageSwitcher /></div>
        </div>
      )}
    </>
  );
}
