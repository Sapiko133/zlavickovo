# Zlavickovo — plán (NOVÁ VÍZIA: zľavy + akcie + kódy, Heureka = 0)

Override 28. 8. 2026: **ZLAVICKOVO = AKTUÁLNE ZĽAVY + AKCIE + ZĽAVOVÉ KÓDY. HEUREKA = 0. PRODUKTOVÝ POROVNÁVAČ = 0. PRODUKTOVÝ KATALÓG = 0.** Viď `PROJECT_VISION.md`. Starý product-first master outline je zrušený.

## Working rules
- Každý rez: `npx tsc --noEmit` + `npm run lint` + cielený test + `npm run build` čistý → selektívny commit → deploy (`git push origin main`).
- Selektívne commity: konfliktné/necommitnuté staré zmeny nepridávať naslepo.
- Zachovať všetko užitočné pre kupóny, akcie, obchody, affiliate a SEO.

## HOTOVÉ (prežíva z foundation práce, nasadené)
- [x] Freshness model `lib/offers/freshness.ts` (kupóny/akcie, SK dátumy, expirácia).
- [x] Cross-source dedup `lib/offers/dedupe.ts`.
- [x] Cache-policy `lib/feeds/cache-policy.ts` (36 h) — platí pre coupon cache.
- [x] Design tokeny v `globals.css` (light-only).
- [x] Trust komponenty `components/commerce/*` + `lib/offers/evidence-labels.ts`.
- [x] Admin feed health + provider refresh (upraviť: coupon-only, bez Heureky/produktov).
- [~] Monetizačný resolver `lib/offers/outbound.ts` — PREROBIŤ bez Heureka fallbacku.
- [~] Deal score `lib/deals/score.ts` — ponechať, ale bez price-history dôkazov (produkty preč).

## FÁZA A — DEMOLÍCIA Heureky a produktového katalógu

- [ ] **A1. Prerobiť outbound bez Heureky**: `lib/offers/outbound.ts` samostatný (direct affiliate → shop affiliate → neplatený link), odstrániť Heureka fallback a haff. Upraviť `lib/outbound-ui.ts`. _Verify: test-offer-outbound bez Heureka vetvy._
- [ ] **A2. Odstrániť produktové/Heureka stránky a API**: `app/produkt/[slug]`, `app/produkty`, `app/api/feed-search`, `app/api/cron/import-heureka`, `app/api/cron/price-watch-notify`, `app/api/price-watch/*`, `app/api/admin/{heureka-migrate,heureka-stats,price-history-cleanup}`. _Verify: build, žiadne mŕtve odkazy._
- [ ] **A3. Odstrániť Heureka komponenty**: `HeurekaWidget`, `HeurekaSearch`, `HeurekaPriceChart`, `ProductPriceHistory`, `ShopPriceDrops`, `ShopProducts`, `PriceWatchForm`, príp. `AiCoupons`. Odstrániť trixam script z `app/layout.tsx`. _Verify: build._
- [ ] **A4. Odstrániť `lib/heureka/*`** a produktové feed-catalog (`lib/feeds/FeedManager`, `*AutoFeed`, `AffialFeedProvider` produktová časť) ak slúžia iba produktovému searchu. Upraviť `lib/sale-articles.ts` (bez price-drops/products), `lib/feeds/health.ts` (coupon-only), `app/kupony/[slug]` (bez feed-shop-slug). _Verify: tsc/build._
- [ ] **A5. DB cleanup**: dropnúť `hk_products`, `hk_feeds`, `hk_import_*`, `product_price_history`, `price_watches` (idempotentne, po overení, že ich nič nové nepoužíva). Zachovať `shop_descriptions` + analytiku. Overiť, že Neon 402 zmizne. _Verify: read-only audit po drope._
- [ ] **A6. Env a dead code**: odstrániť `HEUREKA_*` env referencie, `.env.example` čistý, žiadne mŕtve importy. Odstrániť/aktualizovať staré scripts/test-* viazané na Heureku/produkty.

## FÁZA B — DEAL DISCOVERY REBUILD

- [ ] **B1. Homepage**: NAJLEPŠIE AKCIE → NAJNOVŠIE ZĽAVY → ZĽAVOVÉ KÓDY → OBĽÚBENÉ OBCHODY → KATEGÓRIE. Kompaktný search, server-first, expirované preč, žiadny článkový hero.
- [ ] **B2. Shop page `/kupony/[obchod]`**: obchod → aktuálne kódy → aktuálne akcie → info; dynamický mesiac; bez produktov/porovnávača; dedup + freshness.
- [ ] **B3. `/kupony` landing**: H1, coupon/shop search, nové kódy, akcie bez kódu, kategórie, crawlable pagination.
- [ ] **B4. `/akcie` live deal listing**: aktuálne canonical akcie s filtrami; legacy články/redirecty zostanú funkčné.
- [ ] **B5. Kategórie ako deal landing**: top akcie/kódy/obchody v kategórii, URL filtre, bez thin contentu.
- [ ] **B6. Search**: obchod / zľava / kód (bez produktov). Autocomplete od 2 znakov, shop → `/kupony/[slug]`.
- [ ] **B7. Karty**: `DealCard` (akcia/zľava) + `CouponCard` (kód: kopírovať + otvoriť monetizovaný link) na tokenoch a trust komponentoch.
- [ ] **B8. Obľúbené obchody + kategórie na homepage** z reálnych dát (click tracking, taxonómia).

## FÁZA C — SEO, PERFORMANCE, QA
- [ ] **C1. Metadata/canonical/noindex** bez neoverených tvrdení; search/filter noindex.
- [ ] **C2. Structured data** podľa viditeľného obsahu (ItemList kódov/akcií, BreadcrumbList, Organization/WebSite+SearchAction).
- [ ] **C3. Sitemap/robots/404**: kupóny/kategórie/akcie/obchody/letáky; produktové URL preč (redirect/410 podľa hodnoty).
- [ ] **C4. Performance**: server-first, bez N+1, cache po importe.
- [ ] **C5. Mobile-first + WCAG AA** pass.
- [ ] **C6. E2E QA + deal/coupon/affiliate**: žiadne fake claims, expirácie, dedup, tracking.
