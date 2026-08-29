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
- [x] Admin feed health prerobený na coupon-only (bez Heureky/produktov/refresh).
- [x] Monetizačný resolver `lib/offers/outbound.ts` prerobený bez Heureka fallbacku.
- [x] Deal score `lib/deals/score.ts` ponechaný (bez price-history dôkazov).

## FÁZA A — DEMOLÍCIA Heureky a produktového katalógu

- [x] **A1. Prerobiť outbound bez Heureky**: `lib/offers/outbound.ts` samostatný (direct affiliate → shop affiliate → neplatený link), odstrániť Heureka fallback a haff. Upraviť `lib/outbound-ui.ts`. _Verify: test-offer-outbound bez Heureka vetvy._
- [x] **A2. Odstrániť produktové/Heureka stránky a API**: `app/produkt/[slug]`, `app/produkty`, `app/api/feed-search`, `app/api/cron/import-heureka`, `app/api/cron/price-watch-notify`, `app/api/price-watch/*`, `app/api/admin/{heureka-migrate,heureka-stats,price-history-cleanup}`. _Verify: build, žiadne mŕtve odkazy._
- [x] **A3. Odstrániť Heureka komponenty**: `HeurekaWidget`, `HeurekaSearch`, `HeurekaPriceChart`, `ProductPriceHistory`, `ShopPriceDrops`, `ShopProducts`, `PriceWatchForm`, príp. `AiCoupons`. Odstrániť trixam script z `app/layout.tsx`. _Verify: build._
- [x] **A4. Odstrániť `lib/heureka/*`** a produktové feed-catalog (`lib/feeds/FeedManager`, `*AutoFeed`, `AffialFeedProvider` produktová časť) ak slúžia iba produktovému searchu. Upraviť `lib/sale-articles.ts` (bez price-drops/products), `lib/feeds/health.ts` (coupon-only), `app/kupony/[slug]` (bez feed-shop-slug). _Verify: tsc/build._
- [x] **A5. DB cleanup**: SPUSTENÉ proti prod 29.8.2026 — `drop_obsolete` dropol `hk_*`, `product_price_history`, `price_watches` CASCADE. DB 490 MB → 8 MB, zostal len `shop_descriptions`. Overené cez `action=sizes`.
- [x] **A6. Env a dead code**: odstrániť `HEUREKA_*` env referencie, `.env.example` čistý, žiadne mŕtve importy. Odstrániť/aktualizovať staré scripts/test-* viazané na Heureku/produkty.

## FÁZA B — DEAL DISCOVERY REBUILD

- [x] **B1. Homepage**: redizajn 29.8.2026 (svetlý hero, search hore, lišta kategórií, grid akcií + sidebar Top kupóny/Populárne obchody, grid obchodov). Server-first, expirované preč.
- [x] **B2. Shop page `/kupony/[obchod]`**: coupon-first (kódy → akcie → info), dynamický mesiac, dedup+freshness, BreadcrumbList/JSON-LD; bez produktov/porovnávača.
- [x] **B3. `/kupony` landing**: H1, coupon/shop search, nové kódy, akcie, kategórie; canonical + noindex pri filtri.
- [x] **B4. `/akcie` live deal listing**: canonical akcie; legacy články/redirecty funkčné.
- [x] **B5. Kategórie ako deal landing**: `/kategoria/[slug]` s BreadcrumbList + FAQPage, top obchody/akcie.
- [x] **B6. Search**: obchod/zľava/kód, autocomplete od 2 znakov, shop → `/kupony/[slug]` (commit e923faf).
- [x] **B7. Karty**: `CouponCard`/`DealCard` na dizajn tokenoch + WCAG CTA (commity 4f574fd, 9566944).
- [x] **B8. Obľúbené obchody + kategórie na homepage** z reálnych dát (click tracking, taxonómia).

## FÁZA C — SEO, PERFORMANCE, QA
- [x] **C1. Metadata/canonical/noindex**: landing pages majú canonical; `/kupony` noindex pri filtri; `/hladat` noindex,follow (29.8.2026).
- [~] **C2. Structured data**: Organization/WebSite+SearchAction (homepage), BreadcrumbList + FAQPage (shop/kategória). CHÝBA: ItemList kódov/akcií na listingoch.
- [x] **C3. Sitemap/robots/404**: sitemap = kupóny/kategórie/akcie/obchody/letáky (18+ mimo, žiadne produktové URL); robots disallow /api,/admin.
- [~] **C4. Performance**: server-first + Redis cache (36 h) + ISR revalidate. CHÝBA: cielený audit N+1/bundle.
- [~] **C5. Mobile-first + WCAG AA**: mobile-first layouty + WCAG CTA kontrast (B7). CHÝBA: úplný AA pass (focus/aria/kontrasty naprieč).
- [ ] **C6. E2E QA + deal/coupon/affiliate**: žiadne fake claims, expirácie, dedup, tracking — neurobené.
