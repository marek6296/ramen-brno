# Ramen Brno — TV menu board

Interaktívne live menu pre TV v prevádzke Václavská (Brno), napojené na ChoiceQR.

**Live:** https://ramen-brno.vercel.app
**Lokálne:** `npm run dev` → http://localhost:4000
**Deploy:** `vercel --prod` (projekt `ramen-brno`, scope `mareks-projects-a2a1ac64`)

---

## 1. Cieľové zariadenie

Samsung The Frame QE50LS03F (2025) — 50", 3840×2160, 16:9, matný displej.
Klient zapne TV → otvorí prehliadač (Tizen) → stránka na fullscreen.

Z toho vyplývajú návrhové rozhodnutia:

| Rozhodnutie | Prečo |
|---|---|
| Všetky rozmery v `vh`, nič v `px` | Layout je identický na 1080p aj 2160p. Overené na 1920×1080 aj 2560×1440 — pixel za pixel to isté. |
| Žiadny scroll, `overflow: hidden` | Na TV nie je ako scrollovať. Všetko sa musí zmestiť na jednu obrazovku. |
| Pomalý drift ±6 px / 240 s | Ochrana proti vypáleniu panela pri 10 h statického obrazu denne. |
| Matný papier + stlmená textúra (opacity 0.16) | The Frame má matný displej; ich originálne pozadie v plnom kontraste znemožňuje čítanie z 3–4 m. |
| Bez fotiek, bez `:has()`, bez container queries | Ich podpora v Tizen prehliadači je nespoľahlivá. |
| Roboto + Roboto Condensed | Rovnaký font ako klientov web (ChoiceQR default) a jediný overený s plnou CZ diakritikou — viď nižšie. |
| Textúra pozadia na 7 %, text stmavený | Kontrast: názvy 17,3:1 · popisy 11,9:1 · sekundárny text 5,2:1. WCAG AA je 4,5:1. |

## 2. Dátový zdroj — ChoiceQR

Reverzne zistené z ich vlastného webu (`vaclavska.ramen-brno.cz`):

```
GET https://vaclavska.ramen-brno.cz/api/public/menu          → CZ
GET https://vaclavska.ramen-brno.cz/api/public/menu?lang=en  → EN
```

Jedna odpoveď (~94 kB) obsahuje **všetko**: kategórie, položky, ceny,
popisy vrátane zloženia a nutričných hodnôt, alergény, kcal, štítky
(vegetariánske / pálivé / novinka / doporučujeme), fotky z CDN,
prídavky (`menu_options`), otváraciu dobu, `opened` flag aj URL ich
pozadia a loga.

Detaily:

- **Ceny sú v halieroch** — `8000` = 80 Kč.
- **Endpoint nemá CORS hlavičky.** Musí sa volať zo servera →
  `app/api/menu/route.ts` + server component. Z prehliadača priamo to nepôjde.
- **EN len cez `?lang=en`** — `?language=`, `?locale=` ani `Accept-Language`
  nefungujú. Merge CZ + EN robíme po `_id`.
- ⚠️ Je to **nezdokumentovaný interný endpoint**, nie oficiálne API.
  Môže sa zmeniť bez varovania. Adaptér (`lib/menu.ts`) je preto izolovaný
  a stránka pri chybe drží posledné dobré dáta na obrazovke.
  Ak ChoiceQR ponúka oficiálne partner API, oplatí sa časom prejsť naň.

### Čo je v menu (stav k dnešku, ťahané live)

- **Chuťovky** 2 (Edamame 80, Karaage 132)
- **Rameny** 9 (8× 285 Kč + Dětský 120)
- **Prídavky** 12 (čajové vejce +30 … trhané vepřové +60, oleje +10)
- **Dezert** 1 · **Nápoje** 15 · **Alkohol** 11

## 3. Layout (podľa skice klienta)

```
┌──────────┬────────────┬────────────┬──────────┐
│ CHUŤOVKY │ RAMEN 1–5  │ RAMEN 6–9  │ DEZERTY  │
│ K tomu   │            │            │ NÁPOJE   │
│ PŘÍDAVKY │            │            │ ALKOHOL  │
└──────────┴────────────┴────────────┴──────────┘
```

Bez fotiek — čistá typografická tabuľa.

Odchýlky od skice:
- **Prídavky sú len raz**, dole v 1. stĺpci pod chuťovkami. V skici sú
  v oboch ramen stĺpcoch, ale dva bloky sa pri reálnom objeme textu
  nezmestili, duplicita nič nepridáva — a chuťovky sú samy o sebe
  len 2 položky, takže by tam inak ostalo prázdno. Takto sú vľavo
  „malé veci k jedlu" a v strede celé rameny s väčším písmom.
- Rameny sa v stĺpci rozprestrú do plnej výšky (`space-between`),
  takže oba stĺpce končia nadoraz.

Každá položka: **CZ názov → EN názov → CZ popis → EN popis → štítky /
kcal / gramáž / alergény → cena.** Presne ako klient chcel — česky veľké,
anglicky malé pod tým.

## 4. Fonty — pozor

Pôvodne som použil japonské fonty (Shippori Mincho / Zen Kaku Gothic New).
Google Fonts pri nich **deklaruje `latin-ext`, ale glyfy s háčikom a krúžkom
v tých súboroch nie sú** — `DĚTSKÝ RAMEN` sa vykreslil mixom dvoch písiem,
lebo prehliadač robí per-glyph fallback.

Teraz beží všetko na **Roboto / Roboto Condensed** — to isté, čo má klientov
web, takže je to aj vizuálne konzistentné. Overené priamo v prehliadači,
všetkých 30 českých znakov sedí. Japonské kana (ラーメン, 前菜, 甘味) majú
vlastný `Noto Sans JP`, lebo Roboto ich nemá.

Ak by sa font niekedy menil, **overiť empiricky**, nie z deklarácie —
postup je v `Claude/Patterns/google-fonts-latin-ext-klame.md`.

## 5. Aktualizácia dát

- Server cache 60 s (`revalidate`)
- Prehliadač si po tichu ťahá `/api/menu` každých 5 min → zmena ceny
  v ChoiceQR sa na TV prejaví do ~6 minút bez dotknutia sa telky
- Pri výpadku siete ostane posledné načítané menu na obrazovke

## 6. Celá obrazovka na TV

Aby na TV nebola vidno lišta prehliadača:

1. Otvor stránku v prehliadači na TV.
2. Klikni na tlačidlo **„Celá obrazovka"** vpravo dole (alebo stlač **F**).
   Lišta prehliadača zmizne (Fullscreen API).
3. Po 3 s nečinnosti sa **kurzor aj tlačidlo automaticky skryjú** →
   úplne čistý obraz. Von z režimu = Back / ESC na diaľkovom.

Poznámky:
- Auto-spustiť fullscreen pri načítaní **sa nedá** — prehliadače to
  povolia len po kliknutí používateľa. Preto tlačidlo.
- Po vypnutí a zapnutí TV treba kliknúť znova. Na trvalé „zapni a je to
  tam samo" pridať stránku ako **bookmark / web app na home screen** Tizenu
  (nastavenie na telke, nie v kóde).

## 7. Otvorené / ďalší krok

- [ ] **Interaktivita cez diaľkový ovládač** — teraz je to ambientná tabuľa
      bez ovládania (najspoľahlivejšie). Ak má reagovať na D-pad
      (šípky = prechádzanie jedál, OK = detail s veľkou fotkou),
      treba to doplniť — je to ~pol dňa práce.
- [x] Deploy na Vercel → https://ramen-brno.vercel.app
- [ ] Prípadne vlastná doména `tv.ramen-brno.cz` (CNAME na Vercel)
- [ ] Auto-štart: Tizen si pamätá poslednú stránku; ideálne pridať
      ako web app / bookmark na home screen TV
- [x] Vypredané položky (`available: false`) → prečiarknuté + „Vyprodáno / Sold out" (2026-09-03)
- [ ] Doladiť: denné menu, QR kód na objednávku k stolu
- [ ] (zámerne neriešené zatiaľ) odolnejšie zaraďovanie podľa názvu; auto-zmenšenie pri pretečení
