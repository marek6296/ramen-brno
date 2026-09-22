# Viac obrazoviek a admin — návrh

Dátum: 2026-09-22
Stav: schválený, pripravený na rozpis prác

## Načo to je

Klient (Ramen Brno, Václavská) má dnes jednu TV s menu. Pribudnú dve ďalšie,
obe **na výšku**. Chce si na nich striedať menu, fotky a videá a spravovať si to
sám, bez toho, aby nám musel volať. Všetko má bežať pod doménou, ktorú už máme —
druhú nekupuje.

## Tvrdé obmedzenie, ktoré určuje celý návrh

**Adresa `/` beží klientovi v prevádzke a nesmie sa pokaziť.**

Z toho plynú tri pravidlá, ktoré platia v každej etape:

1. Súčasná stránka `/` a komponent `app/board.tsx` sa **needitujú**. Menu na
   výšku bude samostatný komponent, nie prerábka existujúceho. Cena je trochu
   opakovaného CSS; odmena je, že bežiacu TV sa nedá rozbiť chybou v adminovi.
2. Všetko nové pribúda **vedľa** ako nové routy (`/tv/…`, `/admin`, `/api/…`).
3. Práca ide na vetve `tv-multiscreen`, nie na `main`. Na `main` sa dostane až
   po odskúšaní.

Neskôr sa `/` môže stať presmerovaním na obrazovku spravovanú cez admin. Nie je
to súčasť tohto návrhu a nepôjde do toho, kým nebude celý systém odskúšaný.

## Rozhodnutia a prečo

| Rozhodnutie | Prečo |
|---|---|
| **Tenká vrstva nad úložiskom** | Kód sa nikde nepýta priamo Supabase, ale nášho rozhrania. Počas vývoja beží nad súborom na disku, takže nie sme blokovaní tým, že klient Supabase ešte nemá. Pripojenie je potom zmena na jednom mieste. |
| **Supabase** na nastavenia aj médiá (na konci) | Je v stacku, ktorý Marek spravuje. Databáza aj úložisko na jednom mieste. Klient ho zatiaľ nemá — pripojíme ho, až keď vznikne. |
| **Prihlásenie do adminu cez premenné prostredia** | Jeden človek, jedno heslo. Netreba naň databázu, takže admin funguje aj pred pripojením Supabase. |
| **Dve samostatné menu** (landscape + portrait) | Obe ťahajú z toho istého ChoiceQR API, ale majú vlastný layout a vlastný súbor. Landscape je hotové a zamrznuté. |
| **Obrazovky v databáze, nie napevno** | Klient povedal, že si to chce dať na viac televízorov. Pridanie štvrtej nesmie znamenať zásah do kódu. |
| **Jedno meno a heslo** | Klient je jeden človek. Účty, role a pozvánky sú zbytočné. Heslo v premennej prostredia, prihlásenie podpísanou cookie. |
| **Video až po Supabase** | Nie preto, že by sa nedalo uložiť, ale kvôli preneseným dátam — pri videách treba vidieť reálne čísla, než sa zvolí tarifa. Obrázky a menu stačia na to, aby systém dával zmysel. |
| **TV si nastavenia pýta sama** | Ku každej TV by inak musel niekto prísť a reštartovať prehliadač. Stránka sa pravidelne pýta, či sa nastavenia nezmenili. |

## Dátový model

### `screens`

| Stĺpec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | |
| `slug` | text, unique | časť adresy: `/tv/<slug>` |
| `name` | text | názov pre admin („TV pri bare") |
| `orientation` | text | `landscape` \| `portrait` |
| `updated_at` | timestamptz | podľa nej TV pozná, že sa niečo zmenilo |

### `playlist_items`

| Stĺpec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | |
| `screen_id` | uuid → `screens.id` | |
| `position` | int | poradie v slede |
| `kind` | text | `menu` \| `image` \| `video` |
| `media_path` | text | cesta k súboru v úložisku; pri `menu` prázdne |
| `duration_s` | int | ako dlho je položka vidieť; pri videu sa berie dĺžka videa |

Médiá idú do úložiska (lokálne počas vývoja, neskôr Supabase Storage).
V databáze je len cesta, nie samotný súbor.

`kind` = `video` sa spracováva až v 2. etape; typ v modeli je od začiatku,
aby sa preň nemusel meniť ani playlist, ani prehrávač.

## Adresy

| Adresa | Čo to je |
|---|---|
| `/` | **nedotknuté** — to, čo beží teraz |
| `/tv/<slug>` | jedna obrazovka; podľa nastavení sa zobrazí na výšku alebo na šírku |
| `/admin` | prihlásenie a nastavenia |
| `/api/screens/<slug>` | nastavenia obrazovky pre TV (verejné, len na čítanie) |
| `/api/admin/…` | zmeny z adminu (za prihlásením) |
| `/api/menu` | **nedotknuté** — existujúci proxy na ChoiceQR |

## Etapy

Rozpis prác, ktorý po tomto návrhu nasleduje, pokrýva **len 1. etapu**. Ďalšie
dostanú vlastný rozpis, až keď bude tá pred nimi odskúšaná.

**Nič z toho nejde klientovi do prevádzky pred pripojením Supabase.** Vercel
nemá disk — ani nahraté súbory, ani nastavenia z adminu by neprežili ďalšie
nasadenie. Platí to rovnako pre obrázky ako pre videá; odklad videa je kvôli
preneseným dátam, nie kvôli ukladaniu.

Ukážkové slidy sú výnimka — sú súčasťou projektu, takže prežijú všetko. Preto
sa dá vzhľad na TV odskúšať hneď a naozaj, nie len na obrazovke počítača.

### 1. etapa — celý systém okrem videa

Beží nad lokálnym úložiskom, takže sa dá postaviť a odskúšať hneď.

- Vrstva nad úložiskom s lokálnou (súborovou) implementáciou
- `/admin` — prihlásenie cez premenné prostredia, zoznam obrazoviek,
  pridať/premenovať/zmazať, prepínač orientácie, odkaz na skopírovanie
- Playlist pre obrazovku: poradie, trvanie, pridať/odobrať/presunúť.
  Typy položiek: `menu` a `image`
- **Sada ukážkových slidov priamo v projekte** (v štýle klienta, v `public/`),
  v adminovi na výber zo zoznamu. Vďaka nim sa dá celé striedanie odskúšať na
  TV bez úložiska. Nahrávanie vlastných pribudne v 2. etape; ukážkové zostanú
  ako rýchla možnosť
- `/tv/<slug>` — prehrávač, ktorý položky strieda; fullscreen tlačidlo
  a skrývanie kurzora ako na súčasnej TV
- TV sa každých ~15 s pýta, či sa nastavenia nezmenili; keď áno, prispôsobí sa

**Hotovo, keď:** po prihlásení sa dá vytvoriť obrazovka, zostaviť sled z menu
a ukážkových slidov, otvoriť adresu obrazovky na TV a vidieť, ako sa striedajú;
zmena v adminovi sa na TV prejaví sama — a `/` medzitým beží nezmenené.

Obrazovka na výšku v tejto etape zvládne obrázky; menu na výšku príde v 3. etape.

### 2. etapa — pripojenie Supabase a video

- Supabase projekt, tabuľky, Storage, premenné prostredia
- Výmena lokálnej implementácie úložiska za Supabase
- Nahrávanie vlastných obrázkov namiesto výberu z ukážkových
- Typ položky `video`, obmedzenie formátov, prehrávanie bez zvuku
- V adminovi údaj, koľko miesta playlist zaberá

**Hotovo, keď:** to isté ako v 1. etape, ale na skutočnej doméne a s videom.

### 3. etapa — menu na výšku

- Nový komponent pre portrait layout (kategórie pod sebou)
- Ťahá z toho istého ChoiceQR adaptéra (`lib/menu.ts`) ako landscape
- Rovnaké správanie pri vypredaných a vypnutých položkách

**Hotovo, keď:** portrait TV ukáže menu čitateľne a reaguje na zmeny v ChoiceQR
rovnako ako súčasná TV.

## Obmedzenia, s ktorými treba rátať

**Videá pôjdu bez zvuku.** Prehliadače nedovolia automatické prehratie so
zvukom. Bez zvuku sa spustí normálne. Obísť sa to nedá — klient to musí vedieť
dopredu.

**Prenesené dáta pri videách.** Ak by playlist sťahoval video pri každom kole,
50 MB video každých 5 minút 12 hodín denne je vyše 200 GB mesačne z jednej TV.
Preto **prehrávač musí médiá držať v pamäti a recyklovať ich**, nie načítavať
nanovo pri každom kole. Pri takom návrhu je to ~jedno stiahnutie na TV za deň.
Toto nie je optimalizácia na neskôr; je to podmienka návrhu prehrávača.

**Formáty.** Televízory sú vyberavé. Povolíme MP4 (H.264) pre video a JPG/PNG/WebP
pre obrázky. V adminovi to bude napísané, aby klient nenahral niečo, čo TV
neprehrá.

**ChoiceQR občas nepošle nič.** Zažili sme, že počas úprav prestal na ~45 sekúnd
posielať sady doplnkov. Portrait menu na to musí byť rovnako odolné ako
landscape — prázdne dáta neznamenajú prázdnu obrazovku navždy.

**Supabase free tier** (overené na ich cenníku, 2026-09-22): 500 MB databáza,
1 GB súborov, **5 GB prenesených dát mesačne**, limit 2 aktívne projekty,
a projekt sa **po týždni nečinnosti uspí**.

- Databáza: pár kB, nie je čo riešiť.
- Prenesené dáta sú tá hranica, o ktorú pôjde. Tri TV, ktoré si raz denne
  stiahnu svoj playlist: pri 50 MB playlistu ≈ 4,5 GB/mesiac (tesne pod),
  pri 100 MB ≈ 9 GB/mesiac (nad). Free teda vyjde len s krátkymi videami.
- Uspatie po týždni bežne nehrozí, lebo TV sa pýtajú každých 15 s. Ale keby
  prevádzka zatvorila na týždeň, projekt zaspí a TV po návrate nenabehnú,
  kým ho niekto ručne nezobudí. Pri niečom, čo visí na stene, to stojí za
  zváženie platenej tarify (25 $/mes.).

Rozhodnutie o tarife padne v 2. etape, keď budú známe skutočné veľkosti
klientových videí — nie teraz odhadom.

## Čo zámerne nerobíme

- Účty, role, pozvánky — klient je jeden človek
- Plánovanie podľa času („ráno toto, večer tamto") — nikto o to nežiadal
- Štatistiky prehrávania
- Ovládanie diaľkovým ovládačom
- Vlastná doména pre obrazovky
- Presmerovanie `/` na obrazovku — až keď bude systém odskúšaný
