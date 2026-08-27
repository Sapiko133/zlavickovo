# Zlavickovo.sk – audit pred kompletnou premenou

Dátum auditu: 27. august 2026

## 1. Rozsah a zdroje auditu

Audit pokrýva lokálny working tree, nasadený web `www.zlavickovo.sk`, read-only Redis dáta, dostupné verejné API, migrácie, importy, cron joby, routy, SEO, search, affiliate/outbound logiku, produktové obrázky, cenovú históriu, analytiku a základné testy.

Produkčnú Neon databázu sa nepodarilo priamo zmerať. Read-only spojenie vrátilo HTTP 402: projekt prekročil compute-time quota. Počty tabuliek, query plány a aktuálny stav indexov preto v tomto audite nie sú odhadované. Schéma je popísaná podľa migrácií a query vrstvy.

## 2. Stav repozitára a nasadenia

- Projekt je Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Neon a Upstash Redis.
- Repozitár má približne 286 súborov: 73 v `app`, 79 v `lib`, 49 skriptov a 35 komponentov.
- Z 69 TSX súborov je 29 client components.
- 60 súborov používa rozsiahle inline styles. Tailwind 4 je prítomný, ale nie je hlavným systémom UI.
- Working tree je výrazne rozpracovaný. Menené sú homepage, search, kupóny, kategórie, produkty, navigácia, SEO a statické dáta.
- Produkcia nezodpovedá lokálnemu working tree. Nasadený web stále obsahuje staršiu homepage a produktový blok, ktorý lokálne zmeny už odstránili.
- Existujú dva staršie briefy s protichodnými cieľmi: `home-redesign` a `coupon-first-redesign`. Najnovšie master zadanie ich produktovo nahrádza.

Záver: projekt sa nesmie prepisovať od nuly ani nasadzovať z aktuálneho working tree bez zladenia rozpracovaných zmien s novým master zadaním.

## 3. Existujúca architektúra, ktorú treba zachovať

### Dátová a importná vrstva

- `hk_products` má URL identitu, cenu, menu, obrázok, doménu, kategóriu, affiliate URL, EAN, item ID, výrobcu, product number, fulltext `search_vec` a `updated_at`.
- `hk_feeds` drží konfiguráciu, enabled stav, posledný fetch, chybu, počet produktov a trvanie importu.
- Bezpečný Heureka import má lock, resumable runs, batchovanie, retry, audit mód, per-feed stav a izoláciu chýb.
- Import upsertuje po URL a ukladá `IMGURL`, `IMAGE_MAIN` alebo `IMGURL_ALTERNATIVE` do `img_url`.
- Product matching používa EAN, potom manufacturer + product number a až potom presný názov.
- Variant Guard filtruje konfliktné balenia/veľkosti. Existujúce testy prešli.
- Centrálna Heureka/outbound vrstva rozlišuje priamy affiliate a Heureka fallback.
- GitHub Actions denne poháňa Heureka import po batchoch, potom cleanup histórie, pipeline health a price-watch notifikácie.

### Monetizácia

- Existuje centrálna logika pre Dognet, eHub, CJ, Affial a Heureka fallback.
- Produktové CTA používajú `getOfferOutbound`; odporúčaná ponuka a CTA sú v produktovom detaile zladené.
- Click tracking rozlišuje product, coupon, action, shop a Heureka fallback kliky.
- Päťsekundová deduplikácia klikov a 24h/7d/30d agregácie fungujú; audit prešiel 16/16.
- Search log má hodinové buckety a 24h/7d/30d okná.

### SEO a routy

- Existujú routy `/kupony`, `/kupony/[slug]`, `/kategoria/[slug]`, `/produkt/[slug]`, `/produkty`, `/akcie`, `/letaky`, `/obchody` a `/hladat`.
- Shop, category, action, leaflet a product detail majú dynamické metadata a canonical.
- Sitemap používa spoločný shop source a filtruje známe 18+ obchody.
- Structured data už používa Organization, WebSite, BreadcrumbList, Product/Offer a miestami FAQPage.
- Existujú permanentné redirecty pre premenované shop slugy a staré blog URL.

Tieto vrstvy sú hodnotné a majú sa rozvíjať, nie nahradiť paralelnou implementáciou.

## 4. Kritické zistenia

### 4.1 Freshness a životný cyklus feedov

Produktový feed cron beží raz denne, ale Dognet, Affial a eHub Redis produktová cache má TTL iba 6 hodín.

Produkčný import 26. augusta načítal:

- Dognet: 1 059 produktov,
- Affial: 2 170 produktov,
- eHub: 474 produktov,
- CJ: 199 položiek,
- spolu: 3 902.

O približne 15 hodín neskôr boli všetky Dognet a eHub produktové cache kľúče expirované. Affial ostal viditeľný, pretože jeho search cesta feedy načítava aj počas používateľského requestu. To je zároveň v rozpore s projektovým pravidlom „žiadne živé načítavanie feedov pri user requeste“.

Admin panel pri chybe alebo cache miss zobrazí `0`, takže nerozlišuje prázdny feed, expirovanú cache a technickú chybu. CJ product count je natvrdo `0` bez ohľadu na import.

UI tvrdí „import každých 6 hodín“, reálny Vercel cron je denný.

### 4.2 Produkty môžu zostať zastarané

Heureka import produkty iba upsertuje. Produkt, ktorý zmizne zo zdrojového feedu, sa automaticky neoznačí unavailable ani sa neodstráni. `updated_at` sa síce obnovuje pri úspešnom upserte, ale verejné query bežne nefiltrujú staré riadky.

Chýba centralizovaný offer/product lifecycle s `last_seen_at`, `status`, `expires_at`, `last_verified_at` a `confidence_score`. Freshness logika je roztrúsená v niekoľkých helperoch a často považuje neparsovateľný dátum za aktívnu ponuku.

### 4.3 Deduplikácia nie je dostatočná

- Akcie používajú primárne `source:id`; rovnaká ponuka z dvoch sietí zostane dvakrát.
- Sekundárny dedup je iba presný `shopSlug + lower(title)`.
- Produkčná kategória Móda zobrazila identickú Bonprix akciu dvakrát.
- Kupóny, akcie a statické položky sa skladajú na viacerých miestach s odlišnou logikou.

Chýba jeden normalizovaný fingerprint cez shop, kód, destination URL, titulok, zľavu, platnosť, campaign a produktovú identitu.

### 4.4 Homepage nie je deal/price discovery

Produkčná homepage je stále článkovo-akciový feed:

- CTA používa „Čítať článok/Čítať“, nie priamo deal CTA,
- prvá karta je veľká a na mobile začína až približne na Y=666 px,
- karta má približne 482 px výšku,
- ponuky nemajú reálne produktové ceny ani porovnanie,
- väčšina vizuálov sú Google favicony alebo generované OG obrázky, nie fotografie produktov,
- top kupóny nie sú rankované deal score; na homepage sa objavil aj 18+ obchod `69shop.sk`, hoci je zo sitemap odfiltrovaný,
- české ponuky nie sú dostatočne oddelené od slovenského primárneho trhu.

Existujúci `scripts/audit-homepage.ts` potvrdil, že lokálna homepage už nespĺňa starší šesťsekciový produktový kontrakt: 10 testov prešlo, 6 statických kontraktov zlyhalo.

### 4.5 Kupóny a shop stránky používajú nedoložené tvrdenia

Produkčný web používa „overené kupóny“, „overené kódy denne“ a „overené obchody“, ale normalizovaný coupon model nemá dôveryhodný `last_verified_at`.

Shop About You zobrazil:

- `0 overených kupónov`,
- generický AI blok,
- duplicitu popisu obchodu,
- generické FAQ tvrdiace, že kupóny sú overené,
- tvrdenia o doprave zdarma bez zdrojového atribútu.

To je v priamom rozpore s pilierom dôvery. Pokiaľ nie je reálny verification event, UI smie komunikovať iba source freshness alebo dátum posledného importu.

### 4.6 Produktová vrstva existuje v kóde, ale verejne je oslabená

- `/api/feed-search` vracia reálne produktové výsledky, ceny, meny, obrázky a monetizované outbound údaje.
- Search audit našiel SK aj CZ produkty a správne zobrazil EUR/CZK.
- `/produkty` na produkcii zobrazil prázdny stav.
- Testovacia `/produkt/...` URL vrátila 404; produktové URL nie sú v sitemap.
- Lokálny working tree navyše pripravuje permanentné presmerovanie všetkých `/produkt/:slug` a `/produkty` na `/akcie`. To je v rozpore s novým master zadaním a nesmie sa nasadiť.
- Lokálny `/hladat` bol prerobený iba na kupóny/akcie/letáky, hoci produktový endpoint stále funguje.

Produktový detail v zdrojovom kóde je naopak kvalitný základ: best purchase, Variant Guard, ceny, alternatívne ponuky, kupóny, história ceny, Heureka fallback a price watch.

### 4.7 Reálne obrázky sú dostupné, UI ich nevyužíva naplno

Parsery reálne čítajú:

- Heureka/Affial: `IMGURL`, `IMAGE_MAIN`, `IMGURL_ALTERNATIVE`,
- Google Shopping: `g:image_link`/`g:image`,
- Dognet: `IMGURL`, `IMAGE_MAIN`, `IMGURL_ALTERNATIVE`, `g:image_link`,
- eHub: `IMAGE_MAIN`, `IMGURL`, `IMGURL_ALTERNATIVE`,
- CJ Product Feed discovery: `imageLink`.

Aktuálna Affial Redis cache obsahovala 12 329 produktov, z toho 12 314 s HTTP image URL (99,9 %). Vzorky smerovali na reálne CDN obchodov. Dognet a eHub image pokrytie nebolo možné zmerať, pretože ich 6-hodinová cache už expirovala.

V UI však iba 2 súbory používajú `next/image`, 9 súborov používa raw `<img>` a logá často idú cez Google favicon službu. `next.config.ts` nemá deklarovanú image politiku pre reálne feed domény. Image pipeline je dátovo pripravená lepšie než frontend.

### 4.8 Price history je implementovaná, ale v inom režime než master cieľ

- Existuje `product_price_history`, denné unique `(product_url, recorded_day)`, potrebné indexy a zobrazenie štatistík.
- Snapshot sa zapisuje iba pri zmene ceny, nie jeden záznam denne pre každý produkt.
- Implementácia je zámerne úsporná kvôli Neon limitom.
- Retencia je 30 dní, nie 120. Kód uvádza dôvod: približne 90 000 riadkov denne a 512 MB limit Neon databázy.
- Master zadanie povoľuje inú retenciu, ak audit nájde dôvod. Tento dôvod je reálny; 120 dní sa nemá zapnúť bez zmeny storage modelu/plánu.
- Produkčné počty histórie sa nedali overiť kvôli Neon 402.

### 4.9 Search má dobré základy, ale je rozdelený

- `/api/feed-search` má produktovú relevanciu, variant collapsing, domain cap a najnižšiu cenu iba v rámci rovnakej EAN identity.
- `/api/search-v2` hľadá kupóny, akcie a letáky, používa ručný keyword-to-shop map a 15-minútovú cache.
- Autocomplete pracuje so 541 známymi obchodmi a správne rankuje exact/prefix výsledky.
- Produkčný audit našiel slabinu pre `czc` a `samsung`; `czc` vracia nerelevantné substring shopy a `samsung` žiadny shop.
- Shop stránka môže hlásiť 0 kupónov, kým autocomplete pre ten istý obchod vracia kupóny. Source parity nie je spoľahlivá.
- Lokálny SearchPageClient aktuálne ignoruje produktové výsledky, hoci feed-search ich poskytuje.

### 4.10 SEO je funkčné, ale tvrdenia a indexácia potrebujú opravu

- Canonical na hlavných landing pages je prítomný.
- Produkčný `/hladat?q=...` nemal viditeľný `noindex` robots meta, hoci lokálny layout ho už deklaruje.
- Produkty nie sú v sitemap.
- Shop/category FAQ schema korešponduje s viditeľným FAQ, ale obsah FAQ je generický a obsahuje nedoložené tvrdenia.
- `/kupony` nemá ItemList structured data.
- Product structured data existuje v kóde, ale verejná produktová indexácia je nefunkčná/slabá.
- Root metadata a niektoré descriptions používajú blanket tvrdenia „overené“ a „pravidelne aktualizované“, ktoré musia byť viazané na skutočné dáta.

### 4.11 Výkon a server/client hranice

- Dôležité landing pages sú server-rendered, čo je správne.
- UI má veľa inline CSS a 29 client components; nie všetky sú nevyhnutné.
- Search page je klientská a vykonáva separátne requesty.
- `getProductsByCategory` a `getShopProducts` používajú `percent_rank()` nad celou kategóriou/doménou; tieto query nie sú vhodné pre každú homepage požiadavku nad rastúcim katalógom.
- Affial search môže live-fetchovať desiatky feedov pri user requeste.
- Statické affiliate JSON súbory boli pri audite štyri dni staré a prebuild ich prepisuje.
- Build je naviazaný na externé affiliate API cez `prebuild`, hoci chyby sú non-fatal.

## 5. Stav providerov

| Provider | Produkty | Kupóny/akcie | Obrázky | Stav |
|---|---:|---:|---:|---|
| Heureka XML | Áno, Neon | Nie | Áno | Najsilnejší produktový základ; DB quota momentálne blokuje audit |
| Affial | Áno, Redis + live fetch | Áno | Áno, 99,9 % v aktuálnej cache | Funguje, ale architektúra cache/request je nesprávna |
| Dognet | Áno cez auto feed discovery | Áno | Parser podporuje | Produkty po 6 h miznú z cache |
| eHub | 5 DataDepo feedov | Áno | Parser podporuje | Produkty po 6 h miznú z cache |
| CJ | Coupon import; product feed zatiaľ discovery/audit | Áno | `imageLink` v discovery | Admin product count je nesprávny; plný produktový import chýba |
| Awin | Nie | Nie | Nie | Provider je iba TODO stub, nemá sa prezentovať ako aktívny |

## 6. Baseline testy

Prešlo:

- `npx tsc --noEmit`,
- celý ESLint,
- Variant Guard,
- best purchase,
- price history,
- price-history retention test,
- product offers,
- identity,
- click tracking 16/16.

Zlyhalo alebo je zastarané:

- homepage contract: 6 zlyhaní, pretože lokálna homepage bola zmenená na coupon-first smer,
- outbound-search statický test očakáva starý CTA text,
- produkčný DB audit: Neon HTTP 402 quota exceeded.

## 7. Čo zachovať

- App Router a server-first architektúru.
- Heureka bezpečný import, lock, retry, audit a pipeline health.
- EAN/manufacturer+productno identitu a Variant Guard.
- Centralizovaný offer outbound a monetizačnú prioritu.
- Click/search analytické buckety.
- Price watch a existujúcu cenovú históriu.
- Kanonickú taxonómiu a explicitné shop-category mapovanie.
- Existujúce indexované shop/category/action URL a redirecty pre staré slugy.
- Reálne feed image URL a oficiálne Dognet banner API.

## 8. Čo nesmie ísť do nasadenia v aktuálnej podobe

- Globálne presmerovanie `/produkt/:slug` a `/produkty` na `/akcie`.
- Odstránenie produktov zo searchu.
- Claims „overené dnes/denne“ bez verification eventu.
- Generické AI sekcie a AI-generated shop popisy ako dominantný obsah.
- FAQ a meta texty s nedoloženými faktami.
- Deal ranking iba podľa percenta z textu.
- Live feed fetch pri používateľskom requeste.
- 6-hodinová produktová cache pri dennom importe.
- Awin alebo CJ product provider prezentovaný ako hotový, kým je iba stub/discovery.

## 9. Blokery pred implementáciou dátovej vrstvy

1. Obnoviť alebo navýšiť Neon compute quota, aby bolo možné zmerať tabuľky, freshness, image/EAN coverage a EXPLAIN plány.
2. Rozhodnúť nasadenie rozpracovaného working tree až po odstránení konfliktu so starým coupon-first smerom.
3. V ďalšej fáze vytvoriť jeden kanonický model offer freshness/dedup/deal score; nepridávať ďalšiu paralelnú skladaciu vrstvu.

## 10. Auditný záver

Zlavickovo už má väčšinu ťažkej technickej infraštruktúry: produktové importy, reálne obrázky, identitu, Variant Guard, affiliate outbound, click/search analytics, cenovú históriu a SEO routy. Hlavný problém nie je absencia funkcií, ale rozpojenie dátových vrstiev a verejného UX.

Najväčší prínos neprinesie nový frontend položený na dnešné dáta. Najprv treba opraviť freshness, deduplikáciu, verejnú produktovú dostupnosť a dôveryhodné statusy. Potom sa homepage, kupóny, shop, kategória a search môžu postaviť nad jedným deal read modelom bez drahých full-table query a bez fake tvrdení.
