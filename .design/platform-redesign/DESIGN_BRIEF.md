# Design Brief: Zlavickovo Deal & Price Discovery Platform

> Aktuálny zdroj pravdy pre premenu Zlavickovo.sk. Tento brief vychádza z master zadania z 27. augusta 2026 a z technického auditu v `AUDIT.md`. V rozsahu, v ktorom si odporujú, nahrádza staršie „coupon-first“ a homepage briefy. Projekt zostáva kombináciou deals webu, coupon webu a price comparison webu.

## Problem

Používateľ prichádza na Zlavickovo s jednoduchou otázkou: „Kde to teraz kúpim výhodnejšie?“ Súčasné rozhranie mu však odpoveď neposkytne dostatočne rýchlo ani presvedčivo. Reálne produktové dáta, ceny, obrázky, kupóny a monetizované odkazy v projekte existujú, ale sú rozdelené medzi viaceré dátové zdroje a používateľské rozhrania. Homepage pôsobí skôr ako článkový feed, produktová časť je ukrytá a rovnaká ponuka sa môže zobraziť viackrát.

Najväčšou prekážkou nie je nedostatok marketingového textu, ale neistota:

- Je ponuka ešte aktuálna?
- Je zľava reálna alebo iba deklarovaná obchodom?
- Je kupón naozaj platný a kedy bol naposledy overený?
- Ide o rovnaký produkt a variant?
- Je zobrazená najnižšia dôveryhodná cena, alebo iba najvýnosnejší affiliate odkaz?

Na mobile sa prvé reálne ponuky objavujú príliš neskoro a karty obsahujú priveľa sekundárneho obsahu. Používateľ musí stránku študovať namiesto toho, aby ju mohol rýchlo skenovať.

## Solution

Zlavickovo bude živý slovenský nákupný prehľad, v ktorom používateľ už v prvom mobilnom viewporte uvidí kompaktné vyhľadávanie a prvé reálne ponuky. Rozhranie bude postavené na skutočných produktoch, cenách, kupónoch, expirácíách a oficiálnych obrázkoch zo zdrojov. Marketingové vysvetľovanie ustúpi dôkazom, ktoré používateľ potrebuje na rozhodnutie.

Homepage bude prioritizovať aktuálne a dôveryhodné ponuky v jasných blokoch: práve teraz, nové kódy, najväčšie reálne zľavy, končí čoskoro a populárne dnes. Každá sekcia sa zobrazí iba vtedy, keď pre ňu máme dostatočne kvalitné dáta. Vyhľadávanie spojí produkty, obchody, značky, kategórie, kupóny a akcie do jednej zrozumiteľnej cesty.

Stránky kupónov, obchodov, kategórií a produktov budú používať rovnaký vizuálny a dátový jazyk. Používateľ vždy uvidí, čo vieme, odkiaľ to vieme a čo nevieme. Affiliate rozhodovanie zostane na pozadí a nikdy nezmení drahšiu alebo nedôveryhodnú ponuku na odporúčanú.

## Primary Users and Jobs to Be Done

### Používateľ s konkrétnym nákupom

Chce zadať produkt, značku alebo model a do niekoľkých sekúnd zistiť najnižšiu dôveryhodnú cenu, dostupné kupóny a ďalšie porovnateľné ponuky bez zámeny variantov.

### Lovec aktuálnych zliav

Nemá vždy konkrétny produkt. Chce rýchlo prechádzať kvalitné akcie, najväčšie reálne zlacnenia a ponuky končiace čoskoro.

### Používateľ hľadajúci kupón

Pozná obchod a chce nájsť platný kód alebo aktivovateľnú akciu, skopírovať kód a prejsť do obchodu s minimom krokov.

## Success Definition

Rozhranie je úspešné, keď:

- prvá reálna ponuka je na bežnom mobile viditeľná bez dlhého úvodného scrollovania;
- používateľ nájde produkt, obchod, kategóriu alebo kupón z jedného vyhľadávania;
- aktívne sekcie neobsahujú expirované alebo zjavne duplicitné ponuky;
- tvrdenia „overené“, „končí“ a „historické minimum“ sa zobrazia iba pri dostupnom dôkaze;
- produktová stránka jednoznačne odpovie, kde sa dá správny variant kúpiť najvýhodnejšie;
- kupón s kódom sa dá jednou akciou skopírovať a následne otvorí monetizovanú cieľovú stránku;
- podstatný obsah a interné odkazy sú dostupné server-side a crawlable;
- CTA udalosti pre search, coupon copy, affiliate, product, shop, category a deal click sú merateľné;
- mobilné rozhranie je použiteľné palcom, bez prekážajúcich modalov a bez horizontálneho scrollovania.

## Experience Principles

1. **Dôkaz pred tvrdením** -- Cena, zľava, expirácie, popularita a overenie sa zobrazujú iba vtedy, keď ich vieme podložiť aktuálnymi dátami. Chýbajúci údaj sa nevymýšľa.
2. **Ponuka pred vysvetlením** -- Produkt, cena, zľava, kupón, obchod a CTA majú vizuálnu prioritu. Kontextový text je krátky a objaví sa iba tam, kde pomáha rozhodnutiu.
3. **Najlepšia voľba pred najlepšou províziou** -- Ranking a odporúčanie vychádzajú primárne z relevancie, ceny, freshness, dôveryhodnosti a variantovej zhody. Monetizácia je sekundárny tiebreaker a používateľ ju nemusí riešiť.

## Content and Page Outcomes

### Homepage

- kompaktný nadpis a unified search „Čo chceš kúpiť lacnejšie?“;
- malé trendujúce dopyty iba z reálnych alebo kurátorovaných dát;
- prvá deal sekcia začína skoro, bez veľkého hero bloku;
- „Práve teraz“ používa deal score, nie iba deklarované percento;
- „Nové kódy“ rozlišuje kód a akciu bez kódu;
- „Najväčšie zľavy“ odlišuje deklarovanú zľavu od reálneho poklesu ceny;
- „Končí čoskoro“ iba pri dôveryhodnom `expires_at`;
- „Populárne dnes“ iba pri dostatočných analytických dátach, inak transparentný quality/freshness fallback;
- žiadne dlhé sekcie „Ako to funguje“, generické SEO texty alebo článkové CTA.

### `/kupony`

- H1 „Kupóny a zľavové kódy“ a search „Nájdi obchod alebo kupón“;
- najnovšie aktívne kódy a akcie;
- užitočné kategórie vychádzajúce z existujúcej taxonómie;
- rozlíšenie medzi skutočným kódom a aktivovateľnou akciou;
- bez blanket tvrdení o overení všetkých kupónov.

### `/kupony/[shop]`

- dynamický H1 s aktuálnym mesiacom a rokom;
- najlepší dostupný kupón, aktívne kupóny, aktuálne akcie, produkty v akcii a najväčšie zlacnenia;
- podmienky, minimálna objednávka, expirácie a posledné overenie iba ak ich zdroj poskytuje;
- expirované kupóny až nižšie a vizuálne oddelené;
- krátky užitočný kontext namiesto duplicitného AI popisu a generického FAQ.

### `/kategoria/[slug]`

- top aktuálne ponuky, reálne zlacnenia, populárne produkty, relevantné kupóny a obchody;
- používateľsky užitočný filter a radenie bez indexácie prázdnych kombinácií;
- krátky kontext iba tam, kde zlepšuje orientáciu.

### `/produkt/[slug]`

- reálna fotografia, názov, cena, najnižšia dôveryhodná ponuka, obchod a hlavné CTA nad prehybom;
- Variant Guard zostáva povinnou súčasťou porovnávania;
- ďalšie porovnateľné obchody, dostupné kupóny s upozornením na ich rozsah, cenová história a historické minimum iba pri dostatočných dátach;
- affiliate cesta zachová poradie direct product affiliate → affiliate shop → Heureka fallback → neplatený link;
- stránka nesmie tvrdiť, že kupón platí na konkrétny produkt bez takého dôkazu.

### `/hladat`

- spoločné výsledky pre produkty, obchody, značky, kategórie, kupóny a akcie;
- ranking podľa relevance, freshness a kvality, nie podľa poradia v databáze;
- tolerantné spracovanie preklepov a rozumné empty states;
- výsledky nesmú miešať meny ani varianty spôsobom, ktorý vytvára falošnú cenovú výhodu.

## Data Truth Required by the Interface

Vizuálny systém predpokladá normalizovaný read model nad existujúcimi zdrojmi, nie nový paralelný zdroj dát. Verejná ponuka musí vedieť podľa dostupnosti niesť:

- identitu zdroja a obchodu;
- `created_at`, `updated_at`, `starts_at`, `expires_at`, `last_seen_at`, `last_verified_at`;
- kanonický stav `active`, `expiring`, `expired` alebo `unverified`;
- `confidence_score`, source quality a dôvod zobrazeného tvrdenia;
- cenu, menu, pôvodnú cenu, cenu po kupóne a históriu iba tam, kde sú porovnateľné;
- produktový identifikátor a variantové atribúty;
- oficiálny image asset a jeho pôvod;
- deduplikačný fingerprint naprieč sieťami;
- oddelené quality/deal score a monetizačné rozhodnutie.

UI nesmie kompenzovať chýbajúcu freshness alebo deduplikáciu kozmetickým označením. Najprv sa musí opraviť dátový stav a až potom sa príslušný badge alebo sekcia zobrazí.

## Aesthetic Direction

- **Philosophy**: „Editorial commerce utility“ -- hustota a rýchlosť kvalitného nákupného nástroja, čistota moderného e-commerce a dôveryhodnosť cenového porovnávača.
- **Tone**: svieži, presný, pokojne sebavedomý; jemná energia pri dobrých ponukách, bez agresívnej alebo falošnej urgencie.
- **Reference points**: moderné deals a price-comparison rozhrania, produktové listingy kvalitných e-shopov a jednoduché kupónové utility. Referencie sa používajú ako princíp, nie ako vizuálna kópia.
- **Anti-references**: blogový magazín, generická AI landing page, obrovský gradientný hero, preplnený marketplace, blikajúce countdowny, emoji-heavy navigácia, falošné social proof prvky a SEO textové steny.

Hlavná vizuálna hierarchia je vždy: reálny produktový obraz → názov → cena a reálna zľava → kupón → obchod a dôveryhodnosť → CTA.

## Existing Patterns

Projekt nepoužíva externú komponentovú knižnicu ani Storybook. Tailwind CSS 4 je nainštalovaný, ale súčasné rozhranie je prevažne postavené na inline štýloch, lokálnych `<style>` blokoch a jednoduchých React komponentoch.

- **Typography**: root layout načítava Geist a Geist Mono cez `next/font`; globálny body však používa system font a `lib/design-tokens.ts` deklaruje Inter fallback bez jeho načítania. Nový systém má túto nejednotnosť odstrániť a používať Geist ako hlavný sans font.
- **Colors**: existujúca brand zelená `#22C55E` s tmavšími odtieňmi `#16A34A` a `#15803D`; neutrálne farby sú biela, slate/gray texty a svetlé plochy. Zelená zostáva brand a action farbou, nie dekoráciou na každom prvku.
- **Spacing and radius**: súčasné tokeny používajú radius 8/12/16/20 px a malé až stredné tiene. Tieto proporcie sú použiteľný základ, ale musia sa premeniť na konzistentnú škálu a znížiť nadmerné tiene a gradienty.
- **Components**: `Nav`, `Footer`, `HeroSearch`, `CouponCard`, `ShopCouponList`, `ShopProducts`, `ShopPriceDrops`, `ProductPriceHistory`, `HeurekaPriceChart`, `PriceWatchForm`, `TrackedLink`, `ShopLogo` a `ShopFavicon` sú východisková slovná zásoba. Ich dátová alebo interakčná logika sa má zachovať, vizuál a dôveryhodnostné texty sa môžu upraviť.
- **Routing**: Next.js 16 App Router so server-first stránkami je správny základ. SEO a komerčný obsah zostanú renderované na serveri; klientské hranice sa použijú na search, copy, menu, tracking a interaktívne grafy.
- **Images**: existujúce feedy poskytujú `IMGURL`, `IMAGE_MAIN`, `IMGURL_ALTERNATIVE`, Google image polia a CJ `imageLink`. Reálne feed obrázky majú prednosť pred faviconom alebo placeholderom.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Global shell / navigation | Modify | Zjednodušiť mobilnú výšku, odstrániť duplicitné quick links a emoji-heavy prvky, zachovať crawlable navigáciu a unified search vstup. |
| Unified search | Modify | Zlúčiť existujúce `HeroSearch`, `SearchBar`, nav autocomplete, `/api/feed-search` a `/api/search-v2` do jedného konzistentného modelu výsledkov. |
| Section header | New | Kompaktný nadpis, stručný dátový kontext a crawlable „Zobraziť všetko“. |
| Product deal card | New | Reálny image, názov, obchod, aktuálna cena, porovnateľná pôvodná cena, dôveryhodný badge, kupón a CTA. |
| Coupon card | Modify | Zjednodušiť obsah, opraviť copy/open flow, odstrániť nepreukázané „overené“ a rozlíšiť kód od akcie. |
| Deal/action card | New | Pre obchodnú akciu bez konkrétneho produktu; oficiálny campaign asset alebo logo, nie AI obrázok. |
| Expiry badge | New | Zobrazí sa iba pri validnom dátume; stavy dnes, zajtra, do troch dní. |
| Price evidence badge | New | Rozlíši deklarovanú zľavu, reálny pokles a historické minimum. |
| Trust/freshness indicator | New | Presné časové alebo stavové označenie bez blanket „overené dnes“. |
| Offer row / comparison table | Modify | Vychádza z produktovej stránky; zachovať Variant Guard a affiliate resolver, zlepšiť mobilné skenovanie. |
| Price history chart | Modify | Zachovať existujúcu logiku, zobrazovať iba pri dostatku snapshotov a jasne pomenovať 30-dňové okno. |
| Shop identity | Modify | Uprednostniť oficiálne logo; favicon zostáva fallback. |
| Filters and sort | New | Server-readable URL stav; iba užitočné kombinácie, bez thin indexovateľných faciet. |
| Empty/error/stale state | New | Transparentne odlíši prázdny výsledok, dočasne nedostupný zdroj a neoverenú ponuku. |
| Analytics wrapper | Modify | Rozšíriť existujúci `TrackedLink` a click endpoint na dohodnuté udalosti bez novej komplikovanej platformy. |
| Footer | Modify | Odstrániť nepravdivé počty a blanket overenie; zachovať užitočné a právne odkazy. |

## Key Interactions

### Search

Po dvoch znakoch sa zobrazí zoskupený autocomplete pre produkty, obchody, kategórie, kupóny a akcie. Klávesnica podporuje šípky, Enter a Escape. Enter bez vybratej položky otvorí plnú search stránku. Search výsledok jasne ukáže svoj typ a relevantný dôvod zhody.

### Coupon copy and outbound

Pri kupóne s reálnym kódom primárne CTA skopíruje kód, poskytne okamžitú prístupnú spätnú väzbu a otvorí monetizovaný shop link bez straty kódu. Ak kód nie je potrebný, CTA používa „Aktivovať zľavu“. Rozhranie nesmie ukazovať maskovaný alebo vymyslený kód.

### Deal and product outbound

Klik na CTA zaznamená typ zdroja a otvorí resolverom vybranú monetizovanú cestu. Celá karta môže mať crawlable detail link, ale copy, price comparison a CTA zostávajú jasne oddelené, aby nedochádzalo k náhodným klikom.

### Freshness and expiry

Ponuka po dosiahnutí dôveryhodného `expires_at` zmizne z aktívnych sekcií a môže sa presunúť do oddelenej histórie. Ak dátum nepoznáme, countdown sa nezobrazí. Ak import alebo zdroj zlyhá, UI nezamení chybu za „0 ponúk“ bez diagnostického kontextu v admin rozhraní.

### Filtering and ranking

Zmena filtra alebo radenia zachová dopyt v URL, aktualizuje výsledky a poskytne loading stav bez layout shiftu. Default ranking vysvetľujeme zobrazenými dôkazmi (cena, zľava, freshness), nie interným číslom deal score.

## Responsive Behavior

- **Mobile, 320–767 px**: jednokolónový feed; kompaktná sticky navigácia; search na celú šírku; prvá ponuka skoro v prvom viewporte; produktové karty môžu mať horizontálny obrazový layout, ak zostane cena a CTA čitateľná; CTA minimálne 44 × 44 px; žiadne fullscreen menu pre bežné nákupné úlohy.
- **Tablet, 768–1023 px**: dvojstĺpcové listingy, prípadne horizontálne scroll sekcie iba ak majú viditeľný affordance a klávesnicové ovládanie; porovnanie cien zostáva riadkové.
- **Desktop, 1024+ px**: maximálna obsahová šírka približne 1200–1280 px; 3–4 produktové karty podľa obsahu; žiadne zbytočne roztiahnuté textové riadky; sticky prvky nesmú zakrývať obsah.
- Rozloženie musí fungovať pri zväčšení textu na 200 % a pri dlhých názvoch, cenách a kupónových kódoch bez horizontálneho overflow.

## Accessibility Requirements

- WCAG 2.2 AA ako minimum; kontrast bežného textu aspoň 4.5:1 a veľkého textu 3:1.
- Všetky interakcie dostupné klávesnicou s viditeľným focus ringom; hover nikdy nie je jediný nositeľ informácie.
- Search combobox používa zodpovedajúce ARIA roly, aktívnu položku a oznámenie počtu výsledkov.
- Copy CTA oznámi úspech cez `aria-live`; otvorenie nového okna je zrozumiteľné z textu alebo prístupného názvu.
- Obrázky majú zmysluplný alt podľa produktu a obchodu; dekoratívne assety prázdny alt.
- Cena, pôvodná cena a zľava nie sú rozlíšené iba farbou alebo prečiarknutím.
- Countdown sa priebežne neoznamuje screen readeru; používa pokojný textový stav.
- Skeletony a lazy-loaded obrázky rezervujú rozmery, aby nevznikal CLS.
- Animácie rešpektujú `prefers-reduced-motion` a zostanú krátke a funkčné.

## Performance and SEO Constraints

- Kľúčový obsah stránok musí byť server-rendered; klientské komponenty iba pre nevyhnutnú interakciu.
- Homepage nesmie vykonávať celotabuľkové percentilové alebo N+1 query pri každom requeste; výsledky majú používať pripravený read model, indexy a existujúci Redis rozumne.
- Reálne obrázky používajú rozmery, responsive `sizes`, lazy loading mimo LCP a optimalizáciu iba pre povolené a dôveryhodné zdroje.
- Indexované URL zostanú stabilné; zmena vyžaduje permanentný redirect a kontrolu canonicalu.
- Structured data musí zodpovedať viditeľnému obsahu. Žiadne fake ratings, reviews ani FAQ určené iba pre schema.
- Price history zatiaľ komunikuje existujúcu približne 30-dňovú retenciu. Rozšírenie na 120 dní nie je súčasť dizajnového tvrdenia, kým sa nevyrieši kapacita Neon.

## Hard Constraints and Dependencies

- Projekt sa nereštartuje od nuly a existujúce importy, affiliate resolvery, Variant Guard, price history, price watches, trackovanie a SEO routy sa zachovajú, pokiaľ audit nepreukáže chybu.
- Pred produkčnými DB migráciami a query-plan optimalizáciou treba obnoviť dostupnosť Neon; read-only audit bol blokovaný kvótou compute time.
- Cache lifecycle feedov sa musí opraviť skôr, než UI bude sľubovať aktuálnosť. Denný import a 6-hodinový TTL sú nezlučiteľné.
- Import musí rozlišovať chýbajúci/stale produkt od aktívneho produktu. Samotné `updated_at` bez `last_seen_at` alebo stavu nestačí.
- Awin nie je existujúci produkčný zdroj a CJ produktový feed nie je importovaný; brief ich nesmie prezentovať ako hotové.
- Produkty a `/produkt/[slug]` sú súčasťou cieľovej platformy. Lokálne redirecty, ktoré ich odstraňujú, sa nesmú nasadiť.

## Out of Scope

- kompletný rewrite frameworku, databázy alebo affiliate infraštruktúry;
- AI-generované produktové obrázky, náhodné assety z Google Images alebo neoficiálne logá;
- nové fake alebo ručne vymyslené kupóny, expirácie, pôvodné ceny, recenzie, popularita, stock či verification;
- tisíce programatických thin pages a indexovateľné prázdne kombinácie filtrov;
- zmena ceny alebo rankingu v prospech vyššej provízie na úkor používateľa;
- garantovanie 120-dňovej histórie bez vyriešenej DB kapacity;
- plná migrácia analytics na nový externý systém; cieľom je rozšíriť existujúce meranie;
- implementácia nových affiliate partnerstiev Awin alebo CJ product feed bez prístupov, zmluvy a overeného zdroja;
- blogový redakčný systém alebo generovanie dlhých SEO článkov;
- nasadenie na produkciu bez samostatného QA a potvrdenia dátovej integrity.

