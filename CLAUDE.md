# Zlavickovo.sk - Pravidlá projektu

## TECHNICKÉ POŽIADAVKY
- Next.js 16, TypeScript, Vercel hosting
- Upstash Redis pre cache
- npm run build MUSÍ byť čistý pred každým git push

## AFFILIATE SIETE
- Dognet: ad_channel_id=33415 (NIE 8875!)
- Affial: https://www.affial.com/kupony_feed.xml + lib/affial-coupons.ts + lib/affial-shops.ts
- eHub: EHUB_API_KEY + EHUB_PARTNER_ID=85c7b80f
- CJ: CJ_API_KEY + CJ_WEBSITE_ID=101812521

## KUPÓNY - KRITICKÉ PRAVIDLÁ
- Kód VŽDY skrytý pred kliknutím (zobraziť "••••••")
- Pri kliknutí "Zobraziť kód": window.open(affiliateLink, "_blank") + setRevealed(true)
- Affiliate link sa MUSÍ otvoriť keď niekto klikne na kód
- NIKDY nezobrazovať kód bez otvorenia affiliate linku

## HEUREKA - PRAVIDLO
- Heureka widget sa zobrazuje IBA RAZ na každej stránke
- Použi LEN HeurekaWidget s inputom (data-trixam-positionid="71010")
- NIKDY nedávať 2 Heureka boxy na jednu stránku
- Script: //serve.affiliate.heurekashopping.sk/js/trixam.min.js

## DIZAJN
- Primárna farba: #22C55E (zelená)
- Background: #ffffff
- Text: #1d1d1f
- ŽIADNY dark mode
- Mobile-first, testuj na 375px
- Favicony: https://www.google.com/s2/favicons?domain={domain}&sz=128
- Fallback: farebný krúžok s prvým písmenom

## NAVIGÁCIA
- Jeden zdieľaný Nav komponent na všetkých stránkach
- Menu: Obchody | Kupóny | Akcie | Kategórie
- Jeden jazykový prepínač SK/CZ/EN (NIE DVA!)
- BEZ "Obľúbené" tlačidla

## VYHĽADÁVANIE
- Autocomplete od 1 znaku
- Rozlíš: SHOP (obchod) / PRODUCT (produkt) / CATEGORY (kategória)
- SHOP → presmeruj na /kupony/[slug]
- Favicony v autocomplete dropdowne

## STRÁNKA OBCHODU /kupony/[slug]
- Načítaj kupóny z: Dognet (ch33415) + Affial + eHub + CJ + affial-coupons.ts
- Tab menu: Kupóny | Akcie
- Jeden HeurekaWidget dole
- TopCodes sidebar vpravo

## ZAKÁZANÉ
- Google Custom Search API (platené)
- Duplicitné komponenty na jednej stránke
- Fiktívne ceny alebo skladovosť
- Tvrdenie že kupón funguje (vždy "Možný kupón")
- Dark mode

## PO KAŽDEJ ZMENE
1. npm run build (musí byť čistý)
2. git add .
3. git commit -m "popis zmeny"
4. git push
