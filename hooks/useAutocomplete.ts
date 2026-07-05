"use client";

import { useState, useEffect, useRef } from "react";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { TOP_SHOPS } from "@/lib/top-shops";
import { searchMatchRank } from "@/lib/search-normalize";

export interface Suggestion {
  name: string;
  slug: string;
  category: string;
  domain: string;
  price?: string;
  url?: string;
}

const CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

// Kurátorský zoznam obchodov — zdieľaný so serverovým autocomplete (lib/top-shops.ts)

export const PRODUCT_SUGGESTIONS: Suggestion[] = [
  { name: "iPhone",         slug: "", category: "Elektronika", domain: "" },
  { name: "Samsung Galaxy", slug: "", category: "Elektronika", domain: "" },
  { name: "Notebook",       slug: "", category: "Elektronika", domain: "" },
  { name: "PlayStation 5",  slug: "", category: "Elektronika", domain: "" },
  { name: "Nike tenisky",   slug: "", category: "Šport",       domain: "" },
  { name: "Parfum",         slug: "", category: "Krása",       domain: "" },
  { name: "Proteín",        slug: "", category: "Zdravie",     domain: "" },
  { name: "Tablet",         slug: "", category: "Elektronika", domain: "" },
];

// Module-level cache — shared across all instances, survives re-renders
let _shopCache: Suggestion[] | null = null;
let _shopFetchPromise: Promise<void> | null = null;

function buildAffialSuggestions(): Suggestion[] {
  return AFFIAL_SHOPS.map(s => ({
    name: s.name,
    slug: s.domain.replace(/\.(sk|cz|eu|com)$/, "").replace(/\./g, "-"),
    category: CAT_LABELS[s.category] ?? "Iné",
    domain: s.domain,
  }));
}

const AFFIAL_ENTRIES = buildAffialSuggestions();

function mergeUnique(base: Suggestion[], extra: Suggestion[]): Suggestion[] {
  const seen = new Set(base.map(s => s.slug.toLowerCase()));
  return [...base, ...extra.filter(s => s.slug && !seen.has(s.slug.toLowerCase()))];
}

function filterSuggestions(list: Suggestion[], query: string, max = 8): Suggestion[] {
  // Relevancia (normalizovaná, bez diakritiky): exact → startsWith →
  // word boundary → substring ("mall" → Mall pred BabyMall)
  const ranked = list
    .map(s => ({ s, rank: searchMatchRank(s.name, query) }))
    .filter(x => x.rank >= 0);
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.slice(0, max).map(x => x.s);
}

// ── Unified autocomplete (Nav) — products + shops + coupons ──
export interface UnifiedProduct { slug: string; name: string; url: string }
export interface UnifiedShop { name: string; slug: string; domain: string }
export interface UnifiedCoupon { title: string; shopName: string; shopSlug: string }

export interface UnifiedResults {
  products: UnifiedProduct[];
  shops: UnifiedShop[];
  coupons: UnifiedCoupon[];
}

const EMPTY_UNIFIED: UnifiedResults = { products: [], shops: [], coupons: [] };

export function useUnifiedAutocomplete(query: string): { results: UnifiedResults; loading: boolean } {
  const [results, setResults] = useState<UnifiedResults>(EMPTY_UNIFIED);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY_UNIFIED);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetch(`/api/autocomplete?mode=unified&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then((d: UnifiedResults) => {
          setResults({
            products: Array.isArray(d?.products) ? d.products : [],
            shops: Array.isArray(d?.shops) ? d.shops : [],
            coupons: Array.isArray(d?.coupons) ? d.coupons : [],
          });
          setLoading(false);
        })
        .catch((err) => { if (err?.name !== "AbortError") setLoading(false); });
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return { results, loading };
}

export function useAutocomplete(query: string, mode: "shop" | "product" = "shop"): Suggestion[] {
  const [shopDynamic, setShopDynamic] = useState<Suggestion[]>(_shopCache ?? []);
  const [productResults, setProductResults] = useState<Suggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load shop list once (cached in module scope)
  useEffect(() => {
    if (_shopCache !== null) {
      setShopDynamic(_shopCache);
      return;
    }
    if (!_shopFetchPromise) {
      _shopFetchPromise = fetch("/api/autocomplete")
        .then(r => r.json())
        .then((d: Suggestion[]) => { _shopCache = Array.isArray(d) ? d : []; })
        .catch(() => { _shopCache = []; });
    }
    _shopFetchPromise.then(() => {
      if (_shopCache) setShopDynamic(_shopCache);
    });
  }, []);

  // Product search — debounced API call
  useEffect(() => {
    if (mode !== "product" || query.length < 1) {
      setProductResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/autocomplete?mode=product&q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: Suggestion[]) => { if (Array.isArray(d)) setProductResults(d); })
        .catch(() => {});
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode]);

  if (mode === "product") {
    if (query.length < 1) return PRODUCT_SUGGESTIONS.slice(0, 8);
    // Merge API results with static fallback
    const apiNames = new Set(productResults.map(p => p.name.toLowerCase()));
    const staticFallback = filterSuggestions(PRODUCT_SUGGESTIONS, query, 3)
      .filter(s => !apiNames.has(s.name.toLowerCase()));
    return [...productResults, ...staticFallback].slice(0, 8);
  }

  // Shop mode
  if (query.length < 1) return [];
  const all = mergeUnique(TOP_SHOPS, mergeUnique(AFFIAL_ENTRIES, shopDynamic));
  return filterSuggestions(all, query);
}
