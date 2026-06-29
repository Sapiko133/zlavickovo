"use client";

import { useState, useEffect, useRef } from "react";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";

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

const TOP_SHOPS: Suggestion[] = [
  { name: "Alza",        slug: "alza",        category: "Elektronika", domain: "alza.sk" },
  { name: "Mall",        slug: "mall",        category: "Elektronika", domain: "mall.sk" },
  { name: "Datart",      slug: "datart",      category: "Elektronika", domain: "datart.sk" },
  { name: "NAY",         slug: "nay",         category: "Elektronika", domain: "nay.sk" },
  { name: "Zalando",     slug: "zalando",     category: "Móda",        domain: "zalando.sk" },
  { name: "Shein",       slug: "shein",       category: "Móda",        domain: "shein.com" },
  { name: "About You",   slug: "about-you",   category: "Móda",        domain: "aboutyou.sk" },
  { name: "Answear",     slug: "answear",     category: "Móda",        domain: "answear.sk" },
  { name: "Zara",        slug: "zara",        category: "Móda",        domain: "zara.com" },
  { name: "H&M",         slug: "hm",          category: "Móda",        domain: "hm.com" },
  { name: "Dedoles",     slug: "dedoles",     category: "Móda",        domain: "dedoles.sk" },
  { name: "ZOOT",        slug: "zoot",        category: "Móda",        domain: "zoot.sk" },
  { name: "Notino",      slug: "notino",      category: "Krása",       domain: "notino.sk" },
  { name: "GymBeam",     slug: "gymbeam",     category: "Zdravie",     domain: "gymbeam.sk" },
  { name: "Dr. Max",     slug: "dr-max",      category: "Zdravie",     domain: "drmax.sk" },
  { name: "Sportisimo",  slug: "sportisimo",  category: "Šport",       domain: "sportisimo.sk" },
  { name: "Decathlon",   slug: "decathlon",   category: "Šport",       domain: "decathlon.sk" },
  { name: "Nike",        slug: "nike",        category: "Šport",       domain: "nike.com" },
  { name: "Adidas",      slug: "adidas",      category: "Šport",       domain: "adidas.com" },
  { name: "IKEA",        slug: "ikea",        category: "Bývanie",     domain: "ikea.com" },
  { name: "Martinus",    slug: "martinus",    category: "Knihy",       domain: "martinus.sk" },
  { name: "Lidl",        slug: "lidl",        category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",    slug: "kaufland",    category: "Potraviny",   domain: "kaufland.sk" },
  { name: "Temu",        slug: "temu",        category: "Iné",         domain: "temu.com" },
];

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
  const lq = query.toLowerCase();
  const matches = list.filter(s => s.name.toLowerCase().includes(lq));
  matches.sort((a, b) => {
    const aP = a.name.toLowerCase().startsWith(lq) ? 0 : 1;
    const bP = b.name.toLowerCase().startsWith(lq) ? 0 : 1;
    return aP - bP;
  });
  return matches.slice(0, max);
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
