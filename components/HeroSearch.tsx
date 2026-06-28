"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import ShopFavicon from "@/components/ShopFavicon";

type Mode = "shop" | "product";

interface ShopEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

interface ProductEntry {
  label: string;
  category: string;
}

const POPULAR_TAGS = [
  { label: "Alza",      q: "Alza" },
  { label: "Zalando",   q: "Zalando" },
  { label: "iPhone 16", q: "iPhone 16" },
  { label: "Nike",      q: "Nike" },
  { label: "Lidl",      q: "Lidl" },
  { label: "Notino",    q: "Notino" },
];

const PRODUCT_SUGGESTIONS: ProductEntry[] = [
  { label: "iPhone",        category: "Elektronika" },
  { label: "Samsung Galaxy",category: "Elektronika" },
  { label: "Notebook",      category: "Elektronika" },
  { label: "Tablet",        category: "Elektronika" },
  { label: "PlayStation 5", category: "Elektronika" },
  { label: "Xbox",          category: "Elektronika" },
  { label: "Chladnička",    category: "Spotrebiče" },
  { label: "Práčka",        category: "Spotrebiče" },
  { label: "Nike tenisky",  category: "Šport" },
  { label: "Adidas",        category: "Šport" },
  { label: "Parfum",        category: "Krása" },
  { label: "Proteín",       category: "Zdravie" },
];

const CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

const TOP_SHOPS: ShopEntry[] = [
  { name: "Alza",        slug: "alza",        category: "Elektronika",  domain: "alza.sk" },
  { name: "Mall",        slug: "mall",        category: "Elektronika",  domain: "mall.sk" },
  { name: "Datart",      slug: "datart",      category: "Elektronika",  domain: "datart.sk" },
  { name: "NAY",         slug: "nay",         category: "Elektronika",  domain: "nay.sk" },
  { name: "Samsung",     slug: "samsung",     category: "Elektronika",  domain: "samsung.com" },
  { name: "Okay.sk",     slug: "okay",        category: "Elektronika",  domain: "okay.sk" },
  { name: "Zalando",     slug: "zalando",     category: "Móda",         domain: "zalando.sk" },
  { name: "Shein",       slug: "shein",       category: "Móda",         domain: "shein.com" },
  { name: "ASOS",        slug: "asos",        category: "Móda",         domain: "asos.com" },
  { name: "About You",   slug: "about-you",   category: "Móda",         domain: "aboutyou.sk" },
  { name: "Answear",     slug: "answear",     category: "Móda",         domain: "answear.sk" },
  { name: "Zara",        slug: "zara",        category: "Móda",         domain: "zara.com" },
  { name: "H&M",         slug: "hm",          category: "Móda",         domain: "hm.com" },
  { name: "Dedoles",     slug: "dedoles",     category: "Móda",         domain: "dedoles.sk" },
  { name: "Notino",      slug: "notino",      category: "Krása",        domain: "notino.sk" },
  { name: "GymBeam",     slug: "gymbeam",     category: "Zdravie",      domain: "gymbeam.sk" },
  { name: "Dr. Max",     slug: "dr-max",      category: "Zdravie",      domain: "drmax.sk" },
  { name: "Herbatica",   slug: "herbatica",   category: "Zdravie",      domain: "herbatica.sk" },
  { name: "Sportisimo",  slug: "sportisimo",  category: "Šport",        domain: "sportisimo.sk" },
  { name: "Decathlon",   slug: "decathlon",   category: "Šport",        domain: "decathlon.sk" },
  { name: "Nike",        slug: "nike",        category: "Šport",        domain: "nike.com" },
  { name: "Adidas",      slug: "adidas",      category: "Šport",        domain: "adidas.com" },
  { name: "IKEA",        slug: "ikea",        category: "Bývanie",      domain: "ikea.com" },
  { name: "4Home",       slug: "4home",       category: "Bývanie",      domain: "4home.sk" },
  { name: "Martinus",    slug: "martinus",    category: "Knihy",         domain: "martinus.sk" },
  { name: "Panta Rhei",  slug: "panta-rhei",  category: "Knihy",         domain: "pantarhei.sk" },
  { name: "Booking.com", slug: "booking-com", category: "Cestovanie",   domain: "booking.com" },
  { name: "Airbnb",      slug: "airbnb",      category: "Cestovanie",   domain: "airbnb.com" },
  { name: "Invia",       slug: "invia",       category: "Cestovanie",   domain: "invia.sk" },
  { name: "Lidl",        slug: "lidl",        category: "Potraviny",    domain: "lidl.sk" },
  { name: "Kaufland",    slug: "kaufland",    category: "Potraviny",    domain: "kaufland.sk" },
  { name: "Tesco",       slug: "tesco",       category: "Potraviny",    domain: "tesco.sk" },
  { name: "Billa",       slug: "billa",       category: "Potraviny",    domain: "billa.sk" },
  { name: "Lenovo",      slug: "lenovo",      category: "Elektronika",  domain: "lenovo.com" },
  { name: "ZOOT",        slug: "zoot",        category: "Móda",         domain: "zoot.sk" },
  { name: "eobuv.sk",    slug: "eobuv",       category: "Móda",         domain: "eobuv.sk" },
  { name: "Temu",        slug: "temu",        category: "Iné",          domain: "temu.com" },
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
  const seen = new Set(base.map(s => s.slug.toLowerCase()));
  return [...base, ...extra.filter(s => !seen.has(s.slug.toLowerCase()))];
}

function filterShops(shops: ShopEntry[], query: string): ShopEntry[] {
  const lq = query.toLowerCase();
  const matches = shops.filter(s => s.name.toLowerCase().includes(lq));
  // Sort: starts-with first, then contains
  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(lq) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(lq) ? 0 : 1;
    return aStarts - bStarts;
  });
  return matches.slice(0, 8);
}

function filterProducts(products: ProductEntry[], query: string): ProductEntry[] {
  if (!query) return products.slice(0, 8);
  const lq = query.toLowerCase();
  const matches = products.filter(p => p.label.toLowerCase().includes(lq));
  matches.sort((a, b) => {
    const aStarts = a.label.toLowerCase().startsWith(lq) ? 0 : 1;
    const bStarts = b.label.toLowerCase().startsWith(lq) ? 0 : 1;
    return aStarts - bStarts;
  });
  return matches.slice(0, 8);
}

export default function HeroSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("shop");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dynamicShops, setDynamicShops] = useState<ShopEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Dognet + eHub shops from API
  useEffect(() => {
    fetch("/api/autocomplete")
      .then(r => r.json())
      .then((data: ShopEntry[]) => setDynamicShops(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const allShops = useMemo(
    () => mergeShops(mergeShops(TOP_SHOPS, AFFIAL_ENTRIES), dynamicShops),
    [dynamicShops]
  );

  const shopSuggestions = useMemo(
    () => (mode === "shop" && q.length >= 1) ? filterShops(allShops, q) : [],
    [mode, q, allShops]
  );

  const productSuggestions = useMemo(
    () => (mode === "product") ? filterProducts(PRODUCT_SUGGESTIONS, q) : [],
    [mode, q]
  );

  const showShopDropdown = mode === "shop" && open && shopSuggestions.length > 0;
  const showProductDropdown = mode === "product" && open && productSuggestions.length > 0;
  const dropdownVisible = showShopDropdown || showProductDropdown;
  const dropdownLength = showShopDropdown ? shopSuggestions.length : productSuggestions.length;

  useEffect(() => { setHighlight(-1); }, [q, mode]);

  useEffect(() => {
    if (mode === "shop") setOpen(shopSuggestions.length > 0);
    else setOpen(true); // product mode: always show suggestions when focused
  }, [shopSuggestions, mode]);

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

  const navigateShop = useCallback((shop: ShopEntry) => {
    setOpen(false);
    setQ(shop.name);
    router.push(`/kupony/${shop.slug}`);
  }, [router]);

  const navigateProduct = useCallback((label: string) => {
    setOpen(false);
    setQ(label);
    router.push("/hladat?q=" + encodeURIComponent(label));
  }, [router]);

  function go(val?: string) {
    const v = (val ?? q).trim();
    if (!v) return;
    if (mode === "shop") {
      const first = shopSuggestions[0];
      if (first) { navigateShop(first); return; }
      router.push(`/kupony/${v.toLowerCase().replace(/\s+/g, "-")}`);
    } else {
      router.push("/hladat?q=" + encodeURIComponent(v));
    }
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight(h => (h + 1) % dropdownLength);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? dropdownLength - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showShopDropdown && highlight >= 0) {
        navigateShop(shopSuggestions[highlight]);
      } else if (showProductDropdown && highlight >= 0) {
        navigateProduct(productSuggestions[highlight].label);
      } else {
        go();
      }
    }
  }

  function handleModeSwitch(m: Mode) {
    setMode(m);
    setQ("");
    setHighlight(-1);
    setOpen(m === "product"); // open product suggestions immediately
    inputRef.current?.focus();
  }

  const placeholder = mode === "shop"
    ? "Napr. Alza, Zalando, Lidl..."
    : "Napr. iPhone 16, Nike tenisky...";

  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #f0f0f0",
      padding: "56px 24px 48px",
      textAlign: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <h1 style={{
          fontSize: "clamp(24px, 4.5vw, 44px)",
          fontWeight: 800, color: "#1d1d1f",
          letterSpacing: "-1px", lineHeight: 1.15,
          margin: "0 0 28px",
        }}>
          Nájdi zľavy pred každým nákupom
        </h1>

        {/* Mode tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {([["shop", "🏪 Obchod"], ["product", "📦 Produkt"]] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => handleModeSwitch(m)}
              style={{
                padding: "8px 22px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "1.5px solid", fontFamily: "inherit",
                transition: "all 0.15s",
                background: mode === m ? "#22C55E" : "#fff",
                color: mode === m ? "#fff" : "#666",
                borderColor: mode === m ? "#22C55E" : "#e0e0e0",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search row + dropdown */}
        <div ref={containerRef} style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
          <div style={{
            display: "flex",
            border: `2px solid ${open ? "#22C55E" : "#e0e0e0"}`,
            borderRadius: 14,
            background: "#fff",
            boxShadow: open ? "0 0 0 4px rgba(34,197,94,0.10)" : "0 2px 12px rgba(0,0,0,0.06)",
            transition: "border-color 0.15s, box-shadow 0.15s",
            overflow: "visible",
          }}>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="Vyhľadávanie"
              autoComplete="off"
              style={{
                flex: 1, padding: "14px 20px",
                borderRadius: "12px 0 0 12px",
                border: "none", background: "transparent",
                fontSize: 15, color: "#1d1d1f",
                outline: "none", fontFamily: "inherit",
              }}
            />
            {q && (
              <button
                onClick={() => { setQ(""); setOpen(mode === "product"); inputRef.current?.focus(); }}
                tabIndex={-1}
                style={{ padding: "0 10px", border: "none", background: "transparent", color: "#bbb", cursor: "pointer", fontSize: 18 }}
                aria-label="Vymazať"
              >
                ×
              </button>
            )}
            <button
              onClick={() => go()}
              style={{
                padding: "14px 28px", borderRadius: "0 12px 12px 0",
                border: "none", background: "#22C55E",
                color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#16A34A")}
              onMouseLeave={e => (e.currentTarget.style.background = "#22C55E")}
            >
              Hľadať
            </button>
          </div>

          {/* Dropdown */}
          {dropdownVisible && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "#fff", borderRadius: 12,
              border: "1px solid #e8e8e8",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              zIndex: 300, overflow: "hidden",
            }}>
              {showShopDropdown && shopSuggestions.map((shop, i) => (
                <div
                  key={`shop-${shop.slug}-${i}`}
                  onMouseDown={e => { e.preventDefault(); navigateShop(shop); }}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0 16px", height: 52, cursor: "pointer",
                    background: highlight === i ? "#F0FDF4" : "#fff",
                    borderBottom: i < shopSuggestions.length - 1 ? "1px solid #f5f5f5" : "none",
                    transition: "background 0.08s",
                  }}
                >
                  <ShopFavicon domain={shop.domain || ""} name={shop.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shop.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                      {shop.category}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>kupóny →</span>
                </div>
              ))}

              {showProductDropdown && productSuggestions.map((product, i) => (
                <div
                  key={`product-${product.label}-${i}`}
                  onMouseDown={e => { e.preventDefault(); navigateProduct(product.label); }}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0 16px", height: 52, cursor: "pointer",
                    background: highlight === i ? "#F0FDF4" : "#fff",
                    borderBottom: i < productSuggestions.length - 1 ? "1px solid #f5f5f5" : "none",
                    transition: "background 0.08s",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: "#f0fdf4",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                  }}>
                    🔍
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f" }}>
                      {product.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                      {product.category}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>hľadať →</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular tags */}
        <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#aaa" }}>Populárne:</span>
          {POPULAR_TAGS.map(tag => (
            <button
              key={tag.label}
              onClick={() => { setOpen(false); router.push("/hladat?q=" + encodeURIComponent(tag.q)); }}
              style={{
                padding: "5px 14px", borderRadius: 100,
                border: "1.5px solid #e8e8e8", background: "#f5f5f7",
                color: "#555", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#22C55E"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#22C55E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f5f5f7"; e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#e8e8e8"; }}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
