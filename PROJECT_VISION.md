# ZLAVICKOVO.SK – PROJEKTOVÁ ÚSTAVA

## HLAVNÝ OVERRIDE (28. 8. 2026)

**ZLAVICKOVO = AKTUÁLNE ZĽAVY + AKCIE + ZĽAVOVÉ KÓDY.**
**HEUREKA = 0. PRODUKTOVÝ POROVNÁVAČ = 0. PRODUKTOVÝ KATALÓG = 0.**

Toto rozhodnutie **prepisuje všetky staršie inštrukcie** v tomto dokumente aj inde v projekte, ktoré hovoria o Heureke, produktových feedoch, produktovom vyhľadávaní, porovnávaní cien, „najnižšej cene", produktovom katalógu alebo Heureka affiliate fallbacku. Pri rozpore platí tento override.

## 1. Identita projektu

- Zlavickovo je slovenský web na **aktuálne zľavy, akcie a zľavové kódy**.
- Nie je to produktový porovnávač cien.
- Nie je to produktový katalóg so státisícami produktov.
- Nie je to cashback portál.
- Priorita číslo 1 je **AKTUÁLNOSŤ** ponúk.

## 2. Hlavný používateľský cieľ

Používateľ príde a okamžite vidí:

1. najlepšie aktuálne akcie,
2. najnovšie zľavy,
3. zľavové kódy,
4. obľúbené obchody,
5. kategórie,
6. vyhľadávanie obchodu, zľavy alebo kódu.

Cieľ: „Chcem nakúpiť — najprv pozriem Zlavickovo, či nie je niekde akcia alebo kupón."

## 3. Homepage (deal discovery)

Poradie sekcií:

**NAJLEPŠIE AKCIE → NAJNOVŠIE ZĽAVY → ZĽAVOVÉ KÓDY → OBĽÚBENÉ OBCHODY → KATEGÓRIE.**

- Kompaktný search hore („Nájdi obchod, zľavu alebo kód").
- Prvá reálna ponuka viditeľná skoro (aj na mobile 375px).
- Žiadny článkový/blogový hero ako hlavný obsah.
- Expirované akcie a kódy sa NEzobrazujú medzi aktuálnymi.

## 4. Shop stránka `/kupony/[obchod]`

Zameranie:

**OBCHOD → AKTUÁLNE KÓDY → AKTUÁLNE AKCIE/ZĽAVY → relevantné informácie o obchode.**

- Dynamický H1 s aktuálnym mesiacom.
- Logo/identita obchodu.
- Bez produktového gridu, bez porovnávača, bez cenovej histórie.
- Bez nedoložených FAQ a „overené" tvrdení.

## 5. Kupóny a akcie

Rozlišuj:

- kupón s kódom,
- akcia bez kódu (automatická zľava, doprava zdarma, celoshopová akcia).

Pravidlá:

- Kód VŽDY skrytý pred kliknutím („••••••").
- „Kopírovať kód" → skopíruje kód a otvorí monetizovaný shop link.
- Akcia bez kódu → „Aktivovať zľavu".
- Nikdy „overené dnes/denne" bez skutočného verifikačného eventu; komunikuj len source freshness / dátum poslednej aktualizácie.

## 6. Aktuálnosť a stav platnosti

- Každá ponuka má jasný stav platnosti (`starts_at`, `expires_at`, `last_verified_at`/`updated_at`, `status`).
- Kanonický freshness model: `lib/offers/freshness.ts` (neparsovateľný dátum nie je „aktívny", SK `DD.MM.YYYY`, hranice v Europe/Bratislava).
- Expirované ponuky sa vyradia zo všetkých aktívnych merge výsledkov.
- Cross-source deduplikácia: `lib/offers/dedupe.ts` (rovnaká ponuka z dvoch sietí = raz).

## 7. Zdroje dát

- Zľavy a kódy z existujúcich affiliate zdrojov: **Dognet, eHub, CJ, Awin** a ďalších reálne dostupných.
- Coupon/akciové adaptéry: `lib/dognet.ts`, `lib/ehub.ts`, `lib/cj.ts`, `lib/affial*.ts`, statické `lib/akcie.ts` / `lib/affial-coupons.ts`.
- Žiadne živé načítavanie feedov pri používateľskom requeste (import → cache → server page).
- Chyba jedného zdroja nesmie zrušiť ostatné.

## 8. Databáza a cache

- DB je orientovaná na: **shops, deals/actions, coupons, categories, affiliate/network údaje, `starts_at`/`expires_at`, `last_verified_at`, click/usage tracking.**
- ŽIADNE `hk_products`, `hk_feeds`, `product_price_history`, `price_watches` (Heureka/produktový katalóg — odstránené).
- `shop_descriptions` a analytické buckety zostávajú.
- Cache je zrýchľujúca vrstva, nie zdroj pravdy; nesmie zakryť zastarané dáta bez obnovy.

## 9. Monetizácia

Priorita outbound cesty (`lib/offers/outbound.ts` – jediný centrálny resolver):

1. priamy affiliate deep link ponuky/obchodu,
2. shop-level affiliate link (Dognet / CJ / Awin / eHub / Affial),
3. neplatený priamy odkaz iba ak neexistuje monetizovaná alternatíva.

**Žiadny Heureka fallback.** Pravidlá:

- Nepoužívať affiliate wrapper iného obchodu.
- Nevymýšľať tracking parametre.
- Monetizácia nesmie klamať používateľa; lepšia provízia neurobí zo slabej ponuky „najlepšiu".
- Celý projekt používa jeden centrálny outbound helper (žiadne rozdielne `affiliate_url || url` po stránkach).

## 10. Sledovanie klikov

Pri outbound kliku ukladať (ak je to primerané): obchod, typ ponuky (kupón/akcia), affiliate sieť, typ odkazu, zdrojovú stránku, čas.

Typy odkazov: `shop_affiliate`, `dognet`, `cj`, `awin`, `ehub`, `direct_unmonetized`. Tracking nesmie blokovať presmerovanie.

## 11. SEO

Stavaj primárne na:

- `/kupony/[obchod]`,
- kategóriách,
- aktuálnych akciách a zľavových kódoch,
- relevantných indexovateľných landing pages.

Pravidlá:

- Nevytvárať tisíce thin-content URL ani prázdne automatické stránky.
- Indexovateľná stránka má reálnu hodnotu (kódy, akcie, obchody, kategórie).
- Filtrované/searchové URL: `noindex, follow`. Zachovať self-canonical.
- Zachovať existujúce indexované shop/category/leaflet/legacy URL a redirecty.
- Bez blanket „overené" a nepodložených počtov v metadata.

## 12. Trust (dôvera)

Žiadne fake dáta: fake countdown, fake pôvodná cena, fake zľava, fake popularita, fake stock/rating/review, fake coupon verification, fake expirácia. Ak údaj nemáme, nezobrazíme ho. Dôvera > jednorazový klik.

## 13. Admin

Admin umožňuje: spravovať kupóny/akcie/obchody, spravovať a kontrolovať feedy (health per zdroj, cielený refresh), kontrolovať affiliate pokrytie a nefunkčné odkazy. Admin je `noindex`, chránený session heslom.

## 14. Feedy a importy

Feed → kontrolovaný import → cache → server page → používateľ. Importy dávkovať, chyba jedného feedu neruší ostatné, nový zdroj najprv na malej vzorke. Denná cache má rezervu nad cron interval (`lib/feeds/cache-policy.ts`, 36 h).

## 15. Výkon

Server-first pre dôležitý obsah. Bez N+1, bez celotabuľkových rankingov pri requeste, bez importov v request-response cykle. Merať a optimalizovať podľa dát.

## 16. Bezpečnosť

Tajné hodnoty iba v env, `.env` necommitovať, admin/interné API chrániť. Interné endpointy nesmú byť verejne zneužiteľné.

## 17. Pravidlá zmien

Pred: prečítať tento dokument + `.design/platform-redesign/TASKS.md`, nájsť existujúcu implementáciu, nevytvárať duplicitu. Počas: meniť iba nevyhnutné súbory, centralizovať opakovanú logiku, zachovať monetizáciu, build musí byť čistý. Po: vypísať zmenené súbory, zmenu správania, riziká, netestované.

## 18. Čo sa NESMIE robiť

- Vrátiť Heureku, produktový katalóg alebo porovnávač cien.
- Tvrdiť „najlacnejšie" bez porovnania relevantných ponúk (a keďže nie sme porovnávač, takéto tvrdenie vôbec nepatrí na web).
- Tvrdiť, že kupón platí/je overený, ak to nie je doložené.
- Maximalizovať affiliate príjem klamlivým odporúčaním.
- Vytvárať prázdne SEO stránky bez hodnoty.

## 19. Konečné pravidlo

**ZLAVICKOVO = AKTUÁLNE ZĽAVY + AKCIE + ZĽAVOVÉ KÓDY. HEUREKA = 0. PRODUKTOVÝ POROVNÁVAČ = 0.**

Každá funkcia musí podporovať rýchly, aktuálny a dôveryhodný deal/coupon discovery.
