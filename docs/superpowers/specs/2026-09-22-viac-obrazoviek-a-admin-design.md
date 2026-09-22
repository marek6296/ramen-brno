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
| **Supabase** na nastavenia aj médiá | Je v stacku, ktorý Marek spravuje. Databáza aj úložisko na jednom mieste. Bezplatná úroveň (500 MB DB, 1 GB súborov) na tri TV bohato stačí. |
| **Dve samostatné menu** (landscape + portrait) | Obe ťahajú z toho istého ChoiceQR API, ale majú vlastný layout a vlastný súbor. Landscape je hotové a zamrznuté. |
| **Obrazovky v databáze, nie napevno** | Klient povedal, že si to chce dať na viac televízorov. Pridanie štvrtej nesmie znamenať zásah do kódu. |
| **Jedno meno a heslo** | Klient je jeden človek. Účty, role a pozvánky sú zbytočné. Heslo v premennej prostredia, prihlásenie podpísanou cookie. |
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

### `playlist_items` (2. etapa)

| Stĺpec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | |
| `screen_id` | uuid → `screens.id` | |
| `position` | int | poradie v slede |
| `kind` | text | `menu` \| `image` \| `video` |
| `media_path` | text | cesta v Supabase Storage; pri `menu` prázdne |
| `duration_s` | int | ako dlho je položka vidieť; pri videu sa berie dĺžka videa |

Médiá idú do Supabase Storage. V databáze je len cesta, nie samotný súbor.

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

Rozpis prác, ktorý po tomto návrhu nasleduje, pokrýva **len 1. etapu**. Druhá
a tretia dostanú vlastný rozpis, až keď bude tá pred nimi odskúšaná.

### 1. etapa — základ

Inštalatérska práca. Klientovi sa zatiaľ nebude mať čo pozerať; bez nej sa ale
ďalej nedá.

- Supabase projekt, tabuľka `screens`, premenné prostredia
- `/tv/<slug>` — načíta nastavenia, nastaví orientáciu, ukáže menu (landscape)
  alebo zástupný text (portrait, kým nie je čo púšťať)
- Fullscreen tlačidlo a skrývanie kurzora ako na súčasnej TV
- `/admin` — prihlásenie, zoznam obrazoviek, pridať/premenovať/zmazať,
  prepínač orientácie, odkaz na skopírovanie
- TV sa každých ~15 s pýta, či sa nastavenia nezmenili; keď áno, prispôsobí sa

**Hotovo, keď:** klient sa prihlási, vytvorí obrazovku, otvorí jej adresu na TV,
prepne orientáciu v adminovi a TV sa sama prispôsobí — a `/` medzitým beží
nezmenené.

### 2. etapa — playlisty a médiá

- Nahrávanie fotiek a videí do Supabase Storage (z adminu)
- Playlist pre obrazovku: poradie, trvanie, pridať/odobrať/presunúť
- Prehrávač na `/tv/<slug>`, ktorý položky strieda
- Položka typu `menu` pustí menu ako súčasť slede

**Hotovo, keď:** klient nahrá fotku a video, zostaví sled, a na TV sa striedajú
podľa nastavenia.

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

## Čo zámerne nerobíme

- Účty, role, pozvánky — klient je jeden človek
- Plánovanie podľa času („ráno toto, večer tamto") — nikto o to nežiadal
- Štatistiky prehrávania
- Ovládanie diaľkovým ovládačom
- Vlastná doména pre obrazovky
- Presmerovanie `/` na obrazovku — až keď bude systém odskúšaný
