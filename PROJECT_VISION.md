# ZLAVICKOVO.SK – PROJEKTOVÁ ÚSTAVA

## 1. Účel dokumentu

- Tento dokument je záväzná produktová, technická a obchodná vízia projektu Zlavickovo.sk.
- Pred každým auditom, návrhom, implementáciou alebo refaktorom sa musí prečítať.
- Ak je úloha v rozpore s týmto dokumentom, treba zastaviť a upozorniť na rozpor.
- Dokument určuje, ako sa má rozhodovať pri prioritách, technickom návrhu, monetizácii, dátach a používateľskom toku.

## 2. Identita projektu

- Zlavickovo je AI nákupný asistent pre Slovensko.
- Zlavickovo nie je obyčajný kupónový portál.
- Zlavickovo nie je cashback portál.
- Zlavickovo nie je iba katalóg obchodov.
- Zlavickovo nie je obyčajný porovnávač cien.
- Zlavickovo má používateľovi pomôcť rozhodnúť sa, kde a ako kúpiť produkt najvýhodnejšie.

## 3. Hlavný používateľský cieľ

Používateľ má:

1. nájsť produkt,
2. nájsť relevantné ponuky,
3. nájsť najlepšiu cenu,
4. nájsť kupón alebo akciu,
5. dostať odporúčanie,
6. prejsť cez monetizovaný odkaz,
7. sledovať cenu,
8. dostať upozornenie.

## 4. Produkt je stred systému

- Produkt a nákupné rozhodnutie sú centrum celého systému.
- Kupóny, akcie, obchody, blog, newsletter a affiliate siete sú podporné vrstvy.
- Každá funkcia musí pomáhať výhodnejšiemu nákupu.
- Ak funkcia nepomáha používateľovi lepšie kúpiť produkt, lepšie monetizovať nákupný tok alebo zvýšiť konverziu, má nízku prioritu.

## 5. Hlavný nákupný tok

Správny tok je:

Vyhľadanie produktu
→ identifikácia produktu
→ načítanie ponúk
→ porovnanie cien
→ priradenie kupónov a akcií
→ výber najvýhodnejšej ponuky
→ vysvetlenie odporúčania
→ monetizovaný outbound klik
→ zaznamenanie kliku
→ sledovanie ceny.

Tento tok má byť základom produktových stránok, vyhľadávania, odporúčaní, notifikácií aj analytiky.

## 6. Homepage

- Používateľ musí do 5 sekúnd pochopiť: „Nájdi najvýhodnejší nákup.“
- Hlavný prvok homepage je vyhľadávanie.
- Homepage nesmie pôsobiť primárne ako kupónový katalóg.
- Kupóny a akcie môžu byť podporou, ale nesmú prebiť hlavný produktový nákupný tok.
- Homepage má používateľa čo najrýchlejšie viesť k produktu alebo nákupnej potrebe.

## 7. Vyhľadávanie

- Výsledok vyhľadávania nesmie byť iba zoznam.
- Výsledok má ukázať cenu, obchod, kupón, akciu, odporúčanú ponuku a monetizované CTA.
- Systém nesmie predstierať presné porovnanie, ak nevie spoľahlivo spojiť rovnaké produkty.
- Pri neistej zhode treba jasne rozlíšiť podobné produkty od rovnakého produktu.
- Vyhľadávanie má preferovať výsledky, ktoré pomáhajú dokončiť nákup cez legitímny monetizovaný odkaz.

## 8. Identifikácia rovnakých produktov

Priorita identifikácie rovnakých produktov:

1. EAN,
2. product number,
3. manufacturer + product number,
4. normalizovaný názov ako posledný fallback.

Pravidlá:

- Nesmú sa spájať rozdielne varianty podľa podobného názvu.
- Treba rozlišovať veľkosť, farbu, kapacitu, pamäť, balenie, modelový rok a iné varianty.
- Normalizovaný názov je len fallback, nie hlavný dôkaz identity produktu.
- Ak nie je zhoda spoľahlivá, systém má byť konzervatívny.

## 9. Najvýhodnejšia kúpa

- Odporúčanie nesmie byť iba najnižšia náhodná cena.
- Minimálne treba zohľadniť platnú cenu, dostupnosť, monetizovaný outbound link a stabilný tie-breaker.
- Základné poradie:
  1. najnižšia platná cena,
  2. ponuka s monetizovaným affiliate linkom,
  3. doména abecedne.
- Odporúčaná ponuka a hlavné CTA musia smerovať na tú istú ponuku.
- Je neprípustné odporučiť jeden obchod a poslať používateľa do iného.
- Systém musí vysvetliť dôvod odporúčania.
- Ak sú dáta neúplné, systém nesmie tvrdiť viac, než vie overiť.

## 10. Produktová stránka

Produktová stránka musí obsahovať:

1. názov produktu,
2. odporúčanú ponuku,
3. hlavné monetizované CTA,
4. dôvod odporúčania,
5. všetky relevantné ponuky,
6. kupóny a akcie,
7. cenovú históriu,
8. sledovanie ceny.

Pravidlá:

- Hlavné CTA musí viesť na odporúčanú ponuku alebo Heureka fallback.
- Odkaz na kupónovú stránku obchodu nesmie nahradiť nákupné CTA.
- Produktová stránka má oddeliť produktové ponuky od všeobecných kupónov obchodu.
- Používateľ musí rozumieť, prečo je odporúčaná ponuka výhodná.

## 11. Kupóny a akcie

Treba rozlišovať:

- kupón s kódom,
- akciu bez kódu,
- automatickú zľavu,
- dopravu zdarma,
- produktovú akciu,
- celoshopovú akciu.

Pravidlá:

- Kupón sa nesmie automaticky považovať za použiteľný na každý produkt.
- Chyba kupónov nesmie skryť produktové ponuky.
- Produktové dáta a kupónové dáta musia mať oddelené chybové spracovanie.
- Ak kupón nie je overený pre konkrétny produkt, treba to komunikovať opatrne.

## 12. Monetizácia

Každý relevantný outbound klik má byť monetizovaný, ak existuje legitímna cesta.

Priorita monetizácie:

1. priamy affiliate deep link produktu alebo obchodu,
2. Dognet,
3. CJ,
4. Awin,
5. eHub,
6. iná schválená affiliate sieť,
7. Heureka affiliate fallback,
8. nemonetizovaný odkaz iba ak neexistuje legitímna alternatíva.

Pravidlá:

- Nesmie sa používať affiliate wrapper iného obchodu.
- Nesmú sa vymýšľať tracking parametre.
- Vždy preferovať najpresnejší legitímny deep link.
- Monetizácia nesmie byť v rozpore s dôverou používateľa.
- Odporúčanie nesmie byť klamlivé len preto, že má vyšší affiliate výnos.

## 13. Heureka fallback

- Ak shop affiliate chýba, použiť Heureka affiliate fallback.
- Preferovať EAN, potom názov.
- Používať správne URL encoding.
- Pre klasické Heureka odkazy používať `HEUREKA_HAFF_ID` z env a parameter `haff`.
- Trixam widget je samostatný systém a používa voliteľné `HEUREKA_WIDGET_POSITION_ID`.
- `haff` a `positionid` sa nesmú miešať v jednej klasickej Heureka URL.
- Affiliate ID nesmie byť natvrdo v kóde.
- Ak env chýba, nesmie sa tváriť, že odkaz je monetizovaný.
- Shop affiliate deep link má prednosť pred Heureka fallbackom.

## 14. Centralizovaná outbound logika

- Celý projekt musí používať jeden centrálny helper alebo službu pre outbound URL.
- Nesmú existovať rozdielne implementácie `affiliate_url || url` na rôznych stránkach.
- Rovnaká logika sa musí používať vo vyhľadávaní, produktových stránkach, shop stránkach, homepage, autocomplete a notifikáciách.
- Ak sa mení outbound logika, má sa meniť centrálne, nie kopírovaním do komponentov.

## 15. Sledovanie klikov

Pri každom outbound kliku ukladať, ak je to technicky a právne primerané:

- produkt,
- obchod,
- cenu,
- affiliate sieť,
- typ odkazu,
- zdrojovú stránku,
- čas.

Typy odkazov:

- `shop_affiliate`,
- `dognet`,
- `cj`,
- `awin`,
- `ehub`,
- `heureka_fallback`,
- `direct_unmonetized`.

Sledovanie nesmie blokovať presmerovanie.

## 16. Sledovanie cien

Používateľ môže nastaviť:

- cieľovú cenu,
- percentuálny pokles,
- upozornenie na novú výhodnú ponuku.

Najprv treba spoľahlivé uloženie a vyhodnotenie podmienok, potom automatizáciu.

## 17. Cenová história

Ukladať:

- produkt alebo ponuku,
- obchod,
- cenu,
- menu,
- čas.

Zobrazovať:

- aktuálnu cenu,
- minimum za obdobie,
- maximum za obdobie,
- posledný pokles.

Nevydávať odhad budúcej ceny za fakt.

## 18. Shop stránky

Každý obchod má:

- logo,
- kupóny,
- akcie,
- vybrané produkty,
- poklesy cien,
- užitočný opis,
- monetizované odkazy.

Aktuálne dáta majú vyššiu hodnotu než SEO text.

## 19. Feedy a importy

Správny tok:

Feed
→ kontrolovaný import
→ databáza
→ cache
→ API/server page
→ používateľ.

Pravidlá:

- Žiadne živé načítavanie feedov pri používateľskom requeste.
- Importy dávkovať.
- Chyba jedného feedu nesmie zrušiť všetky.
- Nový feed najprv otestovať na malej vzorke.
- Feed bez shop affiliate možno použiť iba s legitímnym Heureka fallbackom alebo inou monetizovanou cestou.

## 20. Databáza a cache

- Databáza je zdroj pravdy.
- Cache je zrýchľujúca vrstva.
- Neukladať celý katalóg iba do Redis.
- Vyhnúť sa stovkám paralelných requestov, N+1 dotazom a importom v request-response cykle.
- Cache nesmie zakryť chybné alebo zastarané dáta bez možnosti obnovy.

## 21. Výkon

Sledovať:

- čas vyhľadávania,
- čas produktovej stránky,
- DB query čas,
- veľkosť odpovedí,
- počet externých requestov,
- timeouty.

Optimalizovať podľa meraní.

## 22. Admin

Admin má umožniť:

- pridať/upraviť kupón,
- pridať/upraviť akciu,
- spravovať obchody,
- spravovať blog,
- spravovať feedy,
- kontrolovať importy,
- kontrolovať affiliate pokrytie,
- kontrolovať nefunkčné odkazy.

Admin má fungovať bez nutnosti zásahu programátora.

## 23. Newsletter a upozornenia

- Newsletter a upozornenia majú byť personalizované podľa sledovaných produktov, obchodov a kategórií.
- Posielať iba relevantné zmeny.
- Používateľ musí mať jednoduché odhlásenie a správu preferencií.
- Upozornenie má viesť na monetizovaný nákupný tok, nie iba na informačnú stránku.

## 24. AI pravidlá

AI použiť na:

- vysvetlenie odporúčania,
- zhrnutie rozdielov,
- interpretáciu nákupnej potreby,
- pomocné texty.

AI nepoužiť na:

- vymýšľanie cien,
- vymýšľanie zliav,
- neoverené tvrdenia,
- drahé volanie pri každom requeste, ak sa dá použiť deterministická logika.

AI má podporovať rozhodnutie používateľa, nie nahrádzať overené dáta.

## 25. SEO

Poradie priorít:

1. použiteľnosť,
2. presnosť dát,
3. monetizovaný nákupný tok,
4. výkon,
5. SEO.

Nevytvárať prázdne automatické stránky bez hodnoty.

## 26. Analytika

Merať:

- vyhľadávania,
- CTR odporúčanej ponuky,
- outbound kliky,
- affiliate sieť,
- sledovania cien,
- Heureka fallback podiel,
- konverzie z affiliate sietí.

Bez reálnych dát nemožno tvrdiť, že projekt je 10/10.
Maximálne interné hodnotenie bez reálnych používateľských dát je 9,5/10.

## 27. Bezpečnosť

- Tajné hodnoty iba v env.
- `.env` necommitovať.
- `.env.example` má obsahovať iba bezpečné názvy premenných.
- Admin a interné API chrániť.
- Interné endpointy nesmú byť verejne zneužiteľné na importy, tracking manipuláciu alebo únik dát.

## 28. Pravidlá zmien

Pred implementáciou:

1. prečítať `PROJECT_VISION.md`,
2. nájsť existujúcu implementáciu,
3. nevytvárať duplicitnú logiku,
4. určiť presné súbory,
5. vypísať riziká,
6. vysvetliť prínos pre používateľa a monetizáciu.

Pri implementácii:

- meniť iba nevyhnutné súbory,
- nerobiť nesúvisiace refaktory,
- centralizovať opakovanú logiku,
- zachovať monetizáciu.

Po implementácii vypísať:

- zmenené súbory,
- zmenu správania,
- riziká,
- čo nebolo testované.

## 29. Pravidlá auditu

Ak je úloha audit:

- nič neupravovať,
- oddeliť fakt, hypotézu a chýbajúce dáta,
- vypísať konkrétne súbory a funkcie,
- rozdeliť kritické a nízke riziká.

Audit má viesť k rozhodnutiam, nie k všeobecným dojmom.

## 30. MVP poradie

1. produktové dáta,
2. vyhľadávanie,
3. monetizované odkazy,
4. najvýhodnejšia kúpa,
5. produktová stránka,
6. kupóny a akcie,
7. tracking klikov,
8. cenová história,
9. sledovanie ceny,
10. notifikácie,
11. pokročilé AI.

Nezačínať mobilnú aplikáciu, cashback, univerzálny chatbot, zložitý master katalóg alebo veľký prepis architektúry, kým jadro nefunguje.

## 31. Kritické chyby

Kritické sú:

- CTA vedie inde než odporúčaná ponuka,
- existuje nemonetizovaný klik napriek dostupnému affiliatu,
- nesprávna cena,
- nesprávne spojené produkty,
- import poškodzuje dáta,
- kupónová chyba skryje ponuky,
- env chyba potichu vypne monetizáciu.

Kritické chyby majú prednosť pred novými funkciami.

## 32. Čo sa nesmie robiť

- Meniť projekt na obyčajný kupónový katalóg.
- Meniť ho na cashback portál.
- Pridávať funkcie iba preto, že sú technicky zaujímavé.
- Tvrdiť „najlacnejšie“, ak sa neporovnali relevantné ponuky.
- Tvrdiť, že kupón platí, ak to nie je overené.
- Maximalizovať affiliate príjem klamlivým odporúčaním.

Dôvera používateľa je dôležitejšia než jednorazový klik.

## 33. Rozhodovacie otázky

Pred väčšou funkciou odpovedať:

1. Aký problém rieši?
2. Ako pomáha výhodnejšiemu nákupu?
3. Ako ovplyvní monetizáciu?
4. Ako ovplyvní konverziu?
5. Aké dáta potrebuje?
6. Sú dáta spoľahlivé?
7. Existuje už podobná funkcia?
8. Dá sa použiť jednoduchšie MVP?
9. Aké sú riziká?
10. Ako sa bude merať úspech?

## 34. Konečný cieľ

Používateľ zadá produkt alebo potrebu.

Zlavickovo:

- nájde relevantné ponuky,
- porovná ceny,
- priradí kupóny a akcie,
- odporučí najvýhodnejšiu možnosť,
- vysvetlí odporúčanie,
- použije legitímny monetizovaný link,
- zaznamená klik,
- umožní sledovať cenu.

Každá funkcia musí podporovať tento cieľ.
