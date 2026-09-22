# Editor slidov — návrh

Dátum: 2026-09-22
Stav: schválený, pripravený na rozpis prác

## Načo to je

Dnes sú slidy hotové SVG súbory v `public/demo/`. Klient si ich nevie zmeniť —
keď chce inú akciu, musí nám napísať. Chce si ich naklikať sám: vybrať jedlo
z menu, dopísať text, zvoliť vzhľad a animáciu.

Pritom nie je dizajnér a beží mu to na 50-palcovej obrazovke, kde je každá
chyba v sadzbe vidieť cez celú miestnosť.

## Rozhodnutia a prečo

| Rozhodnutie | Prečo |
|---|---|
| **Šablóny s políčkami, nie plátno** | Plná voľnosť v rukách nedizajnéra skončí amatérskym výsledkom. Rozloženie, písma a medzery určuje návrh; klient dopĺňa len obsah. Nemá to ako pokaziť. |
| **Slide je vyrobený raz a použiteľný všade** | Klient má tri televízory. Akcia dňa pôjde na všetky a pri zmene ceny sa musí zmeniť naraz. Slide preto žije vo vlastnej tabuľke, sled naň len odkazuje. |
| **Jeden slide, obe orientácie** | Šablóna nie je obrázok, ale komponent. Ten istý obsah sa na šírku a na výšku **preskladá**, nie roztiahne. Klient vyplní raz a dostane oboje. |
| **Jedlá sa ťahajú živo z ChoiceQR** | V slide sa uloží len odkaz na jedlo. Názov, popis a bežná cena prídu živo — klient ich zmení v ChoiceQR a slide sa zmení sám. Inak by tie isté údaje žili na dvoch miestach a raz by sa rozišli. |
| **Akciová cena sa píše ručne** | ChoiceQR pozná len bežnú cenu. Zľavnenú si zadá klient. |
| **Slidy chodia na TV spolu s nastaveniami obrazovky** | Jeden dopyt namiesto dvoch a úprava slidu sa na TV prejaví tým istým 15-sekundovým dopytom, ktorý už existuje. |

## Dátový model

### Nová tabuľka `slides`

| Stĺpec | Typ | Poznámka |
|---|---|---|
| `id` | uuid | |
| `name` | text | názov pre admin („Akcia dne — ramen") |
| `template` | text | `akcia` \| `uvitanie` \| `oznamenie` \| `novinka` |
| `variant` | text | `papier` \| `tmava` \| `oranzova` |
| `animation` | text | `ziadna` \| `nastup` \| `text` \| `zoom` |
| `fields` | jsonb | obsah podľa šablóny, viď nižšie |
| `updated_at` | bigint | milisekundy, rovnako ako pri `screens` |

`updated_at` dvíha rovnaký databázový trigger ako pri `screens` — televízor
podľa neho pozná zmenu.

### Položka v slede

Do `ItemKind` pribudne `"slide"`. Položka takého typu má vyplnené `slideId`;
`mediaPath` ostáva prázdne. Trvanie sa riadi `durationS` ako pri obrázku.

### `fields` podľa šablóny

```ts
akcia:     { nadpis, nadpisEn?, dishIds: string[], akciovaCena?, podtext?, podtextEn? }
uvitanie:  { nazov, kana?, podtitul?, podtitulEn?, zobrazitHodiny: boolean }
oznamenie: { text, textEn?, podtext?, podtextEn? }
novinka:   { dishIds: string[], stitok?, stitokEn? }
```

Pri `uvitanie` sa otváracia doba ťahá živo z ChoiceQR, nezadáva sa.

**Anglické polia sú nepovinné.** Keď ostanú prázdne, na slide sa anglický
riadok jednoducho nezobrazí — nie prázdne miesto po ňom. Doska menu je
dvojjazyčná, takže možnosť tam patrí, ale nútiť klienta prekladať každé
oznámenie by znamenalo, že to nakoniec nechá prázdne alebo tam napíše
nezmysel.

Názvy a popisy jedál prichádzajú z ChoiceQR dvojjazyčne samy — tie sa
neprekladajú ručne.

## Ako sa slidy dostanú na televízor

`GET /api/screens/<slug>` bude okrem obrazovky vracať aj **mapu slidov**, ktoré
jej sled používa:

```json
{ "screen": { … }, "slides": { "<id>": { … } } }
```

Televízor si tým pádom vystačí s jedným dopytom a úprava slidu sa naň dostane
do 15 sekúnd bez reloadu — rovnakým mechanizmom, aký už funguje pre nastavenia.

**Pozor na spätnú kompatibilitu:** dnes tá routa vracia obrazovku priamo, nie
zabalenú. Prehrávač aj routa sa musia zmeniť naraz.

## Vykresľovanie

Jeden komponent na šablónu, spoločný pre obe orientácie. Orientáciu dostane
ako vlastnosť a podľa nej preskladá rozloženie — nie cez `transform: scale`,
ale skutočne iným usporiadaním.

```
NA ŠÍRKU                        NA VÝŠKU
┌──────────────────────┐        ┌────────────┐
│ AKCE DNE             │        │  AKCE DNE  │
│ NARUTO    275 → 225  │        │   NARUTO   │
│ vepřový vývar, Miso… │        │ 275 → 225  │
│ do 20:00             │        │  vepřový…  │
└──────────────────────┘        │  do 20:00  │
                                └────────────┘
```

Všetky rozmery vo `vh`, ako zvyšok projektu — rovnaký výsledok pri 1080p aj 4K.

Farebné varianty sú tri pevné dvojice, aby si klient nemohol vybrať nič, čo
zhučí. Farby sú z vizuálu reštaurácie, rovnaké ako na doske menu:

| Variant | Pozadie | Text | Zvýraznenie |
|---|---|---|---|
| `papier` | `#f4f2ec` | `#14110f` | `#a8500c` |
| `tmava` | `#14110f` | `#f4f2ec` | `#d9741a` |
| `oranzova` | `#a8500c` | `#f9f5ee` | `#14110f` |

Animácie sú len CSS (`opacity`, `transform`) a púšťajú sa pri nástupe slidu.
Žiadne JavaScriptové slučky — televízor beží celý deň.

## Keď jedlo zmizne z ChoiceQR

Klient mení menu často; zažili sme aj to, že ChoiceQR na 45 sekúnd neposlal nič.

- Jedlo, ktoré sa v dátach nenájde, sa zo slidu **vynechá**.
- Keď v slide po vynechaní **nezostane žiadne jedlo**, televízor slide
  **preskočí** a ide na ďalšiu položku sledu.
- Slide bez jedál (Uvítanie, Oznámenie) sa nepreskakuje nikdy.

Nikdy sa nesmie ukázať prázdny rámec ani text typu „undefined".

## Admin

Nová sekcia **Slidy** vedľa Obrazoviek:

- zoznam slidov s malým náhľadom, názvom a šablónou
- tlačidlo na vytvorenie — najprv výber šablóny, potom editor
- editor: vľavo políčka, vpravo **skutočný náhľad**, prepínateľný na šírku /
  na výšku. Nie približný obrázok — ten istý komponent, ktorý pôjde na TV.
- výber jedál z ChoiceQR: zoznam jedál s názvom a cenou, zaškrtávanie
- rovnaká lepiaca lišta s neuloženými zmenami ako v editore obrazovky

V editore obrazovky pribudnú slidy do tej istej mriežky „Pridať do sledu",
medzi menu a nahraté médiá.

## Etapy

### 1. etapa — stroj + dve šablóny

Tabuľka, sekcia v adminovi, editor s náhľadom, vykresľovanie na TV, animácie,
šablóny **Akcia** a **Uvítanie**, preskočenie prázdneho slidu.

**Hotovo, keď:** klient vyrobí akciu s jedlom z menu, pridá ju na dve TV
s rôznou orientáciou, na oboch vyzerá dobre, a po zmene ceny v ChoiceQR sa
zmení sama.

### 2. etapa — zvyšné dve šablóny

**Oznámenie** a **Novinka** do hotového stroja.

Dôvod delenia: prvá etapa je celá nová stavba a chceme na nej počuť názor skôr,
než do nej pribudnú ďalšie šablóny. Keby sa mala prekopať, nech je to lacné.

## Čo zámerne nerobíme

- Voľné plátno ani presúvanie prvkov — rozpor s tým, aby to vyzeralo profesionálne
- Vlastné nahrávanie písiem a ľubovoľné farby — varianty sú pevné a navrhnuté
- Plánovanie slidov podľa času („akcia len do 20:00 sa sama skryje") — nikto o to nežiadal
- Verzie a história zmien slidov
