# Information Architecture: Zlavickovo.sk

> Táto IA vychádza z `DESIGN_BRIEF.md` a `AUDIT.md` v rovnakom priečinku. Zachováva existujúce indexované URL, pokiaľ neexistuje konkrétny dôvod na zmenu. Hlavná používateľská cesta je plytká: vstupná/listing stránka → detail produktu, obchodu alebo kategórie → outbound do obchodu.

## Structural Decisions

- **Najčastejšie úlohy**: 1. skenovať aktuálne ponuky, 2. hľadať produkt, 3. nájsť kupón pre obchod, 4. porovnať cenu, 5. prechádzať kategóriu alebo obchod.
- **Primárny pracovný priestor**: homepage a listingy ponúk. Používateľ na nich strávi väčšinu času skenovaním kariet; detail otvorí až pri nákupnom zámere.
- **Navigačná hĺbka**: maximálne dve obsahové úrovne. Breadcrumb môže mať tri kroky (`Domov → Kategória → Produkt`), no používateľ nemá prechádzať hierarchiou medzistránok.
- **Rastúci obsah**: produkty, obchody, kupóny, akcie, cenové snapshoty a analytické udalosti. Musia používať stránkovanie/cursor, deduplikáciu, freshness a indexačné prahy.
- **Fixný obsah**: právne stránky, kontakt, informácie o službe a základná taxonómia.
- **Jeden verejný web pre všetkých**: nepoužívame osobitné vstupy podľa typu používateľa. Rozdielny zámer rieši unified search a hlavné listingy.

## Site Map

- **Domov** `/`
  - kompaktný unified search;
  - Práve teraz;
  - Nové kódy;
  - Najväčšie zľavy;
  - Končí čoskoro;
  - Populárne dnes;
  - dôležité kategórie a obchody iba ako kontextové odkazy.
- **Akcie** `/akcie`
  - živý listing aktuálnych obchodných a produktových ponúk;
  - filtrovanie podľa kategórie, obchodu a typu ponuky;
  - zachovaný canonical `/akcie`.
  - **Existujúci článkový detail** `/akcie/[slug]`
    - zachovať existujúce indexované URL a permanentné `/blog/[slug]` redirecty;
    - nové články nepatria do hlavného deal feedu;
    - existujúce články majú kontextové odkazy na aktuálne ponuky, nie opačne;
    - pri obsahovo prázdnych/starých článkoch rozhodnúť jednotlivo medzi aktualizáciou, 410/404 alebo relevantným redirectom, nie blanket redirectom.
- **Kupóny** `/kupony`
  - search obchodov a kupónov;
  - nové aktívne kódy;
  - aktivovateľné akcie bez kódu;
  - kategórie kupónov;
  - stránkovaný archív aktívneho obsahu.
  - **Obchod: kupóny a zľavy** `/kupony/[shop]`
    - najlepší kupón;
    - aktívne kupóny;
    - aktuálne akcie;
    - produkty v akcii a price drops;
    - relevantné kategórie;
    - expirované kupóny nižšie alebo v sekundárnom zbaliteľnom bloku;
    - normalizované staré slugy zostávajú permanentne presmerované na kanonický slug.
- **Produkty** `/produkty`
  - vyhľadateľný a filtrovaný produktový listing;
  - defaultne kvalitné, čerstvé produkty s reálnym obrázkom a cenou;
  - stránka je indexovateľná iba ak poskytuje stabilnú hodnotu a nie prázdny listing.
  - **Produkt** `/produkt/[slug]`
    - najnižšia dôveryhodná cena;
    - ďalšie variantovo zhodné ponuky;
    - kupóny daného obchodu s jasným obmedzením platnosti;
    - cenová história a sledovanie ceny;
    - podobné produkty a kontextové odkazy na obchod/kategóriu.
- **Kategórie** `/kategoria`
  - crawlable zoznam užitočných kategórií.
  - **Kategória** `/kategoria/[slug]`
    - top aktuálne ponuky;
    - najväčšie reálne zlacnenia;
    - produkty;
    - relevantné kupóny a obchody;
    - filtre bez automatickej indexácie query kombinácií.
- **Obchody** `/obchody`
  - alfabetický/searchable adresár kanonických obchodov;
  - zvýraznené obchody iba z reálnych quality/popularity dát;
  - každý obchod smeruje na `/kupony/[shop]`, nevytvára sa duplicitná detail route.
- **Vyhľadávanie** `/hladat?q=[query]`
  - zoskupené výsledky pre produkty, obchody, kategórie, kupóny a akcie;
  - vždy `noindex, follow`;
  - URL sa dá zdieľať a výsledky obsahujú normálne HTML odkazy.
- **Letáky** `/letaky`
  - sekundárna utility landing page, nie hlavný pilier redesignu.
  - **Leták** `/letaky/[slug]`
    - zachovať existujúce URL, canonical a obchodné prelinkovanie.
- **O Zlavickovo** `/o-nas`
- **Inzercia** `/inzercia`
- **Súkromie** `/privacy`
- **Kontakt** `mailto:info@zlavickovo.sk` alebo budúca stabilná `/kontakt` iba ak vznikne plnohodnotná stránka.
- **Admin** `/admin/*`
  - neprístupný z verejnej navigácie;
  - `noindex, nofollow, nocache`;
  - dashboard;
  - feedy a pipeline health;
  - kupóny;
  - obchody;
  - featured obsah;
  - letáky;
  - cache;
  - články ako legacy redakčná funkcionalita;
  - diagnostika zdrojov a freshness.
- **Systémové stránky**
  - globálna 404;
  - chybový stav zdroja bez predstierania prázdneho výsledku;
  - potvrdenie a odhlásenie price watch ako `noindex`.

## Navigation Model

### Primary navigation

Desktop má maximálne päť položiek:

1. **Akcie** `/akcie`
2. **Kupóny** `/kupony`
3. **Produkty** `/produkty`
4. **Kategórie** `/kategoria`
5. **Obchody** `/obchody`

Logo vždy smeruje na `/`. Unified search je trvalo dostupný v headeri na desktope a na mobile. Letáky sú sekundárna položka, preto patria do utility navigácie alebo menu, nie medzi päť hlavných ciest.

### Secondary navigation

- Homepage sekcie používajú crawlable „Zobraziť všetko“ na príslušný landing.
- `/kupony` používa category chips/links a search, nie samostatný hlboký sidebar.
- `/kupony/[shop]` používa obsahové anchor links iba ak sú na stránke aspoň tri rozsiahle sekcie; nesmie vytvárať nové URL.
- `/kategoria/[slug]`, `/produkty` a `/akcie` používajú kompaktný filter bar. Stav filtra je v query parametroch.
- Produkt a shop detail používajú breadcrumb a kontextové odkazy na obchod, kategóriu a súvisiace produkty.

### Utility navigation

- Letáky, O nás, Inzercia, Súkromie a Kontakt sú vo footeri a rozšírenom menu.
- Jazykový switcher sa zobrazí iba vtedy, ak česká verzia poskytuje plnohodnotný, konzistentný obsah. Samotný `-cz` suffix obchodu nesmie pôsobiť ako globálny jazykový režim bez úplnej lokalizácie.
- Price watch správa zostáva lokálna na produktovej stránke; nevytvára sa účet ani používateľský dashboard.

### Mobile navigation

- Jeden kompaktný sticky header: logo, search trigger/input a menu.
- Pod headerom sa neopakuje druhý rad troch veľkých quick-link chips; k hlavným sekciám sa používateľ dostane z menu a homepage obsahu.
- Mobilné menu je jednoduchý panel s piatimi primárnymi a sekundárnymi utility linkami. Nemá blokovať coupon copy alebo outbound flow ďalším modalom.
- Na produktovom detaile môže byť spodné sticky CTA iba vtedy, keď nezakrýva obsah, cookie/notification prvky a rešpektuje safe-area inset.

## Content Hierarchy

### Homepage `/`

1. **Unified search + stručný value label** -- okamžite rieši konkrétny nákupný zámer bez veľkého hero.
2. **Práve teraz** -- prvé reálne, vysoko skórované ponuky musia byť viditeľné čo najskôr.
3. **Nové kódy** -- druhý hlavný pilier a krátka cesta ku coupon copy.
4. **Najväčšie reálne zľavy** -- až po filtrovaní umelých pôvodných cien.
5. **Končí čoskoro** -- iba pri dôveryhodnom dátume.
6. **Populárne dnes** -- iba pri dostatočných click/view dátach; inak sa sekcia nezobrazí alebo použije označený fallback bez slova „populárne“.
7. **Kategórie a obchody** -- interné prelinkovanie, nie marketingová omáčka.

### Akcie `/akcie`

1. **H1 + počet aktuálnych výsledkov a freshness kontext**.
2. **Filtre/radenie** -- default `Odporúčané`, ďalej `Najnovšie`, `Najväčší reálny pokles`, `Končí čoskoro`.
3. **Deal listing** -- zmiešané product deals a shop actions, ale s jasne odlišnými typmi kariet.
4. **Pagination/load more** -- crawlable paginated URL, klientské „Načítať ďalšie“ môže byť progresívne vylepšenie.
5. **Legacy redakčný obsah** -- ak ostane dostupný, je oddelený a nižšie; nepredstiera aktuálnu akciu.

### Kupóny `/kupony`

1. **H1 + coupon/shop search**.
2. **Nové aktívne kódy** -- kódové ponuky s najvyšším confidence/freshness.
3. **Aktivovateľné akcie** -- samostatne od kódov.
4. **Kategórie a populárne obchody** -- navigácia podľa nákupného zámeru.
5. **Ďalšie aktívne kupóny** -- stránkovaný listing.

### Obchod `/kupony/[shop]`

1. **Identita obchodu + dynamický H1 + presný stav dát**.
2. **Najlepší kupón alebo akcia** -- iba ak existuje jednoznačne kvalitný aktívny kandidát.
3. **Aktívne kupóny**.
4. **Aktuálne akcie bez kódu**.
5. **Produkty v akcii a reálne price drops**.
6. **Relevantné kategórie a interné odkazy**.
7. **Expirované kupóny a krátke informácie** -- oddelené, nižšie, bez generického FAQ.

### Produkty `/produkty`

1. **Product search**.
2. **Filtre a radenie** -- kategória, obchod, cena, dostupný kupón; iba pri spoľahlivých poliach.
3. **Produktové výsledky** -- reálny image, cena, obchod a dôveryhodnosť.
4. **Pagination**.

### Produkt `/produkt/[slug]`

1. **Správny produkt a variant** -- obrázok, názov, značka/kategória a základná identita.
2. **Najnižšia dôveryhodná cena + shop + CTA** -- pri konkrétnom nákupnom zámere je to hlavná odpoveď.
3. **Ďalšie porovnateľné ponuky** -- rovnaký EAN alebo dostatočne silná Variant Guard identita.
4. **Kupóny obchodu** -- s upozornením, že nemusia platiť na produkt; price-after-coupon iba pri dokázanej aplikovateľnosti.
5. **Cenová história a price watch**.
6. **Súvisiace produkty, obchod a kategória** -- interné prelinkovanie.

### Kategória `/kategoria/[slug]`

1. **H1 + top aktuálne ponuky**.
2. **Najväčšie reálne zľavy**.
3. **Produktový listing s filtrami**.
4. **Relevantné kupóny a obchody**.
5. **Krátky kontext** -- iba ak je špecifický pre kategóriu a pomáha používateľovi.

### Search `/hladat`

1. **Aktuálny dopyt + možnosť okamžite ho upraviť**.
2. **Najrelevantnejšie výsledky naprieč typmi**.
3. **Zoskupené sekcie Produkty, Obchody, Kupóny/Akcie, Kategórie**.
4. **Typovo špecifické „Zobraziť všetko“**.
5. **Helpful empty state** -- korekcia dopytu, populárne kategórie alebo obchody; žiadne náhodné substring výsledky.

### Admin feedy `/admin/feedy`

1. **Globálny pipeline status** -- zdravý, degradovaný, zlyhaný; čas posledného úspešného behu.
2. **Provider cards** -- Heureka, Dognet, Affial, eHub, CJ; oddelene config, import, cache, produkty, kupóny a posledná chyba.
3. **Freshness/TTL diagnostics** -- počet aktívnych, stale, expired a missing cache kľúčov.
4. **Import runs** -- feed-by-feed výsledky, nie tiché nuly.
5. **Akcie správcu** -- refresh/retry iba s jasným scope a spätnou väzbou.

## User Flows

### Nájsť najlacnejší konkrétny produkt

1. Používateľ otvorí `/` alebo použije search v headeri.
2. Zadá značku/model; autocomplete zobrazí produkty pred všeobecnými kupónmi, ak query má produktový intent.
3. Vyberie produkt alebo otvorí `/hladat?q=...`.
4. Search ukáže produktové výsledky s cenou, image a shopom.
5. Používateľ otvorí `/produkt/[slug]`.
6. Variant Guard vyhodnotí porovnateľné ponuky.
   - Ak existuje dôveryhodná zhoda → najnižšia cena a ďalšie porovnateľné obchody.
   - Ak je zhoda slabá → stránka zobrazí dostupnú ponuku bez tvrdenia o absolútne najnižšej cene.
7. Používateľ klikne na trackované CTA a otvorí sa resolverom vybraná monetizovaná cesta.

### Nájsť kupón pre konkrétny obchod

1. Používateľ otvorí `/kupony` alebo začne písať obchod v globálnom searchi.
2. Vyberie kanonický obchod a príde na `/kupony/[shop]`.
3. Vidí najlepší aktívny kupón/akciu a stav platnosti.
4. Pri kupóne s kódom klikne „Kopírovať kód“.
   - Kód sa skopíruje, zobrazí sa `aria-live` potvrdenie a otvorí sa affiliate link.
   - Ak kód nie je potrebný, CTA „Aktivovať zľavu“ otvorí affiliate link.
5. Udalosť sa zapíše ako coupon copy/outbound bez uloženia citlivých používateľských údajov.

### Objaviť dobrú ponuku bez konkrétneho produktu

1. Používateľ otvorí `/`.
2. V prvom/tesne druhom mobilnom viewporte vidí sekciu „Práve teraz“.
3. Skenuje image, cenu, reálny discount evidence, shop a CTA.
4. Otvorí produktový detail alebo priamo obchodnú akciu.
5. Pri návrate pokračuje na rovnakom mieste feedu, ak to prehliadač umožní.

### Nájsť ponuky v kategórii

1. Používateľ otvorí `/kategoria` z navigácie alebo kategóriu zo searchu/karty.
2. Príde na `/kategoria/[slug]` a hneď vidí top ponuky.
3. Voliteľne upraví filter/radenie.
4. Otvorí produkt alebo shop detail.
5. Filter query URL zostáva shareable, ale canonical smeruje na čistú kategóriu a filtrované kombinácie sú `noindex, follow`, ak nevznikne samostatná kurátorovaná landing page.

### Ponuka končí čoskoro

1. Pipeline normalizuje dôveryhodný `expires_at`.
2. Ponuka sa zaradí do okna dnes/zajtra/do troch dní.
3. UI zobrazí pokojný textový badge, nie živý sekundový countdown.
4. Po expirácii sa automaticky vyradí z aktívnych listingov.
5. Ak zdroj dát zlyhá, posledný známy záznam sa nepredĺži vymysleným dátumom; prejde do `unverified` alebo `stale` podľa pravidiel.

### Správca zisťuje, prečo admin ukazuje iba Affial feedy

1. Správca otvorí `/admin/feedy`.
2. Vidí samostatne:
   - nakonfigurované feedy;
   - posledný import;
   - aktuálny cache stav;
   - produktový a coupon count;
   - poslednú chybu.
3. Dognet/eHub missing cache sa nezobrazí ako úspešný nulový import.
4. Správca môže spustiť provider-scoped refresh alebo otvoriť detail import runu.
5. Po dokončení sa status a počty aktualizujú bez nutnosti hádať, či je nula chyba alebo skutočný stav.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Product or shop offer | Ponuka | Nezamieňať automaticky so zľavou. |
| Offer with price evidence | Akcia | Použiť pri reálnej alebo obchodom deklarovanej promo ponuke; typ dôkazu ukázať zvlášť. |
| Code required | Kupón / Zľavový kód | CTA „Kopírovať kód“. |
| No code required | Akcia bez kódu | CTA „Aktivovať zľavu“. |
| Current product price | Aktuálna cena | Cena z posledného úspešného importu; časový kontext podľa freshness. |
| Merchant reference price | Pôvodná cena obchodu | Nie historická cena Zlavickovo. |
| Observed price reduction | Reálny pokles ceny | Vyžaduje porovnateľné snapshoty rovnakého produktu/varianty. |
| Historical minimum | Historické minimum | Iba v explicitne uvedenom pozorovanom období. |
| Verification state | Overené [čas] | Iba pri skutočnom `last_verified_at`; inak „Neoverené“ alebo bez labelu. |
| Near expiry | Končí dnes/zajtra/do 3 dní | Iba pri validnom `expires_at`; bez sekundového countdownu. |
| Default ranking | Odporúčané | Interný `deal_score` sa používateľovi nezobrazuje ako magické číslo. |
| Retailer | Obchod | Konzistentne namiesto mixu shop/store/campaign. |
| Outbound action | Pozrieť ponuku | Produkt alebo deal bez kupónového kódu. |
| Coupon outbound | Kopírovať kód / Aktivovať zľavu | Podľa skutočného typu ponuky. |
| Stale pipeline state | Dáta sa aktualizujú | Použiť iba pri známej degradácii, nie ako blanket ospravedlnenie. |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| `SiteShell` | všetky verejné stránky | Header môže byť kompaktnejší na detaile; footer je spoločný. |
| `UnifiedSearch` | header, `/`, `/kupony`, `/produkty`, `/hladat` | Rovnaký dátový kontrakt; placeholder a prioritizácia výsledkov sa môžu meniť podľa kontextu. |
| `Breadcrumbs` | shop, product, category, leaflet, legacy article | Server-rendered `<nav>` a `BreadcrumbList` iba ak sa zhoduje s viditeľnou hierarchiou. |
| `SectionHeader` | homepage a všetky listingy | Voliteľný count, freshness label a „Zobraziť všetko“. |
| `ProductDealCard` | `/`, `/akcie`, `/produkty`, kategória, shop, search | Hustota sa mení, dátové tvrdenia a CTA logika zostávajú rovnaké. |
| `CouponCard` | `/`, `/kupony`, shop, kategória, search | Kompaktná homepage varianta; plná varianta môže ukázať podmienky. |
| `ShopActionCard` | `/`, `/akcie`, shop, kategória | Oficiálny banner iba ak existuje; inak logo + čistá karta. |
| `OfferEvidence` | product/deal cards a detail | Rozlišuje source price, real drop, minimum, expiry a verification. |
| `ShopIdentity` | všetky karty a shop detail | Oficiálne logo → favicon → neutrálna iniciála. |
| `FilterBar` | `/akcie`, `/produkty`, kategória | URL query state, mobilný disclosure bez full-screen komplikácie. |
| `Pagination` | všetky rastúce listingy | Crawlable `?page=N`; klientský load-more je iba progresívne vylepšenie. |
| `OfferComparison` | produkt detail | Variant Guard, menová kompatibilita a affiliate resolver sú povinné. |
| `FreshnessState` | verejné listingy a admin | Verejne stručný dôkaz; admin technický detail a posledná chyba. |
| `TrackedLink` / analytics helper | všetky CTA a interné discovery linky | Typ udalosti sa mení podľa deal/product/shop/category/coupon intentu. |

## Data and Read-Model Flow

```text
Heureka / Dognet / Affial / eHub / CJ / manual admin
                     │
                     ▼
        provider-specific import adapters
                     │
                     ▼
 normalization: shop · currency · URL · image · dates · product identity
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
 freshness/status        cross-source deduplication
 last_seen/confidence     canonical offer + alternatives
          └──────────┬──────────┘
                     ▼
 price evidence + deal score + affiliate resolution metadata
                     │
                     ▼
      cached/indexed public read models by page intent
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   Homepage       Search/API     Detail/listing pages
```

Pravidlá toku:

- provider adapter zachová surový source identifier a raw timestamps pre audit;
- normalizácia nevymyslí neznámu expiráciu, pôvodnú cenu, obrázok ani kupónový kód;
- deduplikácia vytvorí kanonickú verejnú ponuku, ale zachová alternatívne monetizačné cesty;
- affiliate resolver vyberá cestu až po určení dôveryhodnej ceny a zhody produktu;
- verejné stránky čítajú pripravené, limitované result sets; nerankujú celú databázu pri každom requeste;
- admin číta telemetry/import runs aj cache stav, aby odlíšil chybu od reálnej nuly.

## Content Growth Plan

### Products

- Cursor alebo stabilné `page` stránkovanie podľa deterministického ranku a ID.
- Produkty bez recent `last_seen_at`, ceny alebo identity sa vyradia z aktívnych listingov.
- Sitemap nezahrnie všetky desiatky tisíc položiek naraz bez quality/indexability filtra. Použiť delené sitemap indexy až po obnovení a audite DB.

### Coupons and actions

- Aktívne a expirované záznamy sú oddelené stavom, nie iba UI filtrom.
- Duplicitné zdroje sa zlúčia pod kanonickú ponuku.
- Shop landing existuje iba pre kanonický obchod s reálnym obsahom alebo jasným užívateľským zámerom; thin shop pages budú `noindex` alebo 404 podľa dostupnosti dát.

### Categories

- Taxonómia zostáva riadený zoznam, nie automaticky generované keyword kombinácie.
- Nová indexovateľná landing vznikne iba pri stabilnom obsahu, reálnom search intent a internom prelinkovaní.

### Analytics

- Udalosti rastú append-only podľa dohodnutých typov a časového okna.
- Verejný „Populárne dnes“ používa agregácie za 24–72 hodín s minimálnym prahom; surové events sa nečítajú priamo pri každom requeste.

### Legacy articles and leaflets

- Existujúce indexované URL sa zachovajú a auditujú jednotlivo.
- Nevytvárajú hlavný navigačný ani obsahový rastový smer novej platformy.

## URL Strategy

### Stable canonical patterns

- `/`
- `/akcie`
- `/akcie/[legacy-article-slug]`
- `/kupony`
- `/kupony/[canonical-shop-slug]`
- `/produkty`
- `/produkt/[product-name]-[stable-id]`
- `/kategoria`
- `/kategoria/[taxonomy-slug]`
- `/obchody`
- `/hladat?q=[encoded-query]`
- `/letaky`
- `/letaky/[leaflet-slug]`

### Dynamic segments

- Shop slug vzniká jedinou normalizačnou funkciou a aliasy sa permanentne presmerujú na kanonický slug.
- Product slug obsahuje čitateľný názov a stabilné interné ID. Zmena názvu nesmie zmeniť identitu; non-canonical názvový prefix sa môže presmerovať na aktuálnu canonical URL.
- Category slug pochádza výhradne z riadenej taxonómie.
- Locale suffix typu `-cz` zostáva iba tam, kde ho existujúca shop logika skutočne potrebuje; nesmie sa rozšíriť ako neformálny globálny locale pattern.

### Query parameters

- Search: `q`.
- Pagination: `page` pre crawlable listingy; strana 1 kanonizuje na čistú URL.
- Sorting: `sort=recommended|newest|discount|expiring`.
- Filters: stabilné mená ako `category`, `shop`, `type`, `price_min`, `price_max`; iba pri dostupných dátach.
- Tracking parametre sa neukladajú do interných canonical URL.
- Filtrované/query kombinácie sú defaultne `noindex, follow` s canonicalom na čistú landing, pokiaľ nie sú explicitne povýšené na samostatnú kvalitnú stránku.

### Redirect and error rules

- Odstrániť lokálne blanket redirecty `/produkty → /akcie` a `/produkt/:slug → /akcie` pred nasadením.
- Zachovať existujúce permanentné shop alias redirecty a `/blog → /akcie` mapovanie.
- Neznámy shop, produkt, kategória, leták alebo článok vracia reálnu 404; nepresmeruje sa automaticky na homepage alebo všeobecný listing.
- Odstránený obsah s jednoznačnou náhradou dostane 301/308; bez náhrady 404 alebo 410 podľa životného cyklu a existujúcich odkazov.

## Indexation Rules

- **Index**: homepage, kvalitné landingy `/akcie`, `/kupony`, `/produkty`, `/kategoria`, `/obchody`, aktívne shop/category/product detail stránky s reálnou hodnotou a zachované kvalitné legacy URL.
- **Noindex, follow**: search výsledky, bežné filter/sort kombinácie, shop stránky bez dostatočného obsahu, ak musia zostať používateľsky dostupné.
- **Noindex, nofollow**: `/admin/*`, potvrdenia/odhlásenia price watch a technické utility.
- **Sitemap**: iba canonical indexovateľné URL s reálnym obsahom; produkty sa pridajú po quality prahu, stale filtri a škálovateľnom sitemap rozdelení.
- **Canonical**: vždy self-referencing na indexovateľných clean URL; query varianty nesmú vytvárať konkurenčné canonical tvrdenia.

