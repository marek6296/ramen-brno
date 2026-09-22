# Editor slidov — 1. etapa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klient si v adminovi naklikká slide (Akcia alebo Uvítanie), vyberie doň jedlá zo živého ChoiceQR menu, a pridá ho do sledu na ľubovoľnú TV — na šírku aj na výšku vyzerá dobre.

**Architecture:** Slidy žijú vo vlastnej tabuľke a vlastnom `SlideStore` (rovnaké delenie ako `Store` pre obrazovky). Šablóna nie je obrázok, ale React komponent, ktorý ten istý obsah preskladá podľa orientácie. **Ten istý komponent kreslí náhľad v adminovi aj obraz na televízore** — čo klient vidí pri tvorbe, to naozaj dostane.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase cez PostgREST (`fetch`, bez SDK), obyčajné CSS, vitest.

---

## Tvrdé pravidlá pre celú etapu

**Tieto súbory sa NEDOTÝKAJÚ:** `app/page.tsx`, `app/board.tsx`, `app/globals.css`, `app/layout.tsx`, `lib/menu.ts`, `app/api/menu/route.ts`. Beží z nich klientovi TV v prevádzke; stráži to `tests/produkcia.test.ts`.

**`npm run test:db` NESPÚŠŤAJ** — maže obrazovky v databáze. Bežný `npm test` je bezpečný.

**Nikdy nepushuj.** Commituj lokálne.

**Pozor na Task 9** — mení tvar verejnej routy, z ktorej žijú televízory. Routa aj prehrávač sa musia zmeniť v tom istom kroku.

## Štruktúra súborov

| Súbor | Za čo zodpovedá |
|---|---|
| `supabase/02-slidy.sql` | tabuľka, trigger, RLS |
| `lib/slides/types.ts` | tvary slidov + rozhranie `SlideStore` |
| `lib/slides/local.ts` | `SlideStore` nad JSON súborom (vývoj bez DB) |
| `lib/slides/supabase.ts` | `SlideStore` nad Supabase |
| `lib/slides/index.ts` | `getSlideStore()` — vyberá implementáciu |
| `lib/slides/jedla.ts` | hľadanie jedál v `MenuData` + kedy je slide prázdny |
| `app/slides/slide-view.tsx` | rozcestník: podľa `template` vyberie komponent |
| `app/slides/akcia.tsx` | šablóna Akcia, obe orientácie |
| `app/slides/uvitanie.tsx` | šablóna Uvítanie, obe orientácie |
| `app/slides/slides.css` | varianty, animácie, spoločné prvky |
| `app/api/admin/slides/route.ts` | zoznam + vytvorenie |
| `app/api/admin/slides/[id]/route.ts` | úprava + zmazanie |
| `app/api/screens/[slug]/route.ts` | **úprava** — vracia obrazovku aj jej slidy |
| `app/admin/slides/page.tsx` + `slides-list.tsx` | zoznam slidov |
| `app/admin/slides/[id]/page.tsx` + `editor.tsx` | editor s náhľadom |
| `app/admin/layout.tsx` | **úprava** — prepínanie Obrazovky / Slidy |
| `app/admin/screens/[id]/*` | **úprava** — slidy v mriežke „Pridať do sledu" |
| `app/tv/[slug]/*` | **úprava** — vykreslenie slidu, preskočenie prázdneho |
| `lib/storage/types.ts`, `local.ts`, `supabase.ts` | **úprava** — `slide` ako typ položky |

Pozn.: `app/slides/` nemá `page.tsx`, takže z nej nevznikne adresa `/slides`.

---

### Task 1: Tvary slidov

**Files:**
- Create: `lib/slides/types.ts`
- Test: `tests/slides-types.test.ts`

- [ ] **Step 1: Napíš padajúci test**

`tests/slides-types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prazdneFields, SABLONY } from "@/lib/slides/types";

describe("tvary slidov", () => {
  it("pozná obe šablóny 1. etapy", () => {
    expect(SABLONY.map((s) => s.hodnota)).toEqual(["akcia", "uvitanie"]);
  });

  it("nová akcia má prázdne polia a žiadne jedlá", () => {
    expect(prazdneFields("akcia")).toEqual({
      nadpis: "",
      nadpisEn: "",
      dishIds: [],
      akciovaCena: "",
      podtext: "",
      podtextEn: "",
    });
  });

  it("nové uvítanie má zapnuté hodiny", () => {
    expect(prazdneFields("uvitanie")).toEqual({
      nazov: "",
      kana: "",
      podtitul: "",
      podtitulEn: "",
      zobrazitHodiny: true,
    });
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/slides/types'`

- [ ] **Step 3: Napíš `lib/slides/types.ts`**

```ts
export type SlideTemplate = "akcia" | "uvitanie";
export type SlideVariant = "papier" | "tmava" | "oranzova";
export type SlideAnimation = "ziadna" | "nastup" | "text" | "zoom";

/** Polia šablóny Akcia. Anglické sú nepovinné — keď sú prázdne, riadok sa neukáže. */
export type FieldsAkcia = {
  nadpis: string;
  nadpisEn: string;
  /** id jedál z ChoiceQR; názov a cena sa ťahajú živo */
  dishIds: string[];
  /** zľavnená cena ako text — ChoiceQR ju nepozná, píše ju klient */
  akciovaCena: string;
  podtext: string;
  podtextEn: string;
};

export type FieldsUvitanie = {
  nazov: string;
  /** japonská ozdoba, napr. ラーメン */
  kana: string;
  podtitul: string;
  podtitulEn: string;
  /** otváracia doba sa ťahá živo z ChoiceQR, nezadáva sa */
  zobrazitHodiny: boolean;
};

export type SlideFields = FieldsAkcia | FieldsUvitanie;

export type Slide = {
  id: string;
  name: string;
  template: SlideTemplate;
  variant: SlideVariant;
  animation: SlideAnimation;
  fields: SlideFields;
  /** milisekundy; podľa nej TV pozná zmenu, rovnako ako pri obrazovkách */
  updatedAt: number;
};

export type NewSlide = {
  name: string;
  template: SlideTemplate;
};

export type SlidePatch = Partial<{
  name: string;
  variant: SlideVariant;
  animation: SlideAnimation;
  fields: SlideFields;
}>;

export class SlideNotFoundError extends Error {
  constructor() {
    super("Slide nenájdený");
    this.name = "SlideNotFoundError";
  }
}

/**
 * Jediné miesto, cez ktoré sa siaha na slidy. Rovnaké delenie ako `Store`
 * pre obrazovky — implementácia sa dá vymeniť bez zásahu inde.
 */
export interface SlideStore {
  listSlides(): Promise<Slide[]>;
  getSlide(id: string): Promise<Slide | null>;
  getSlidesByIds(ids: string[]): Promise<Slide[]>;
  createSlide(input: NewSlide): Promise<Slide>;
  updateSlide(id: string, patch: SlidePatch): Promise<Slide>;
  deleteSlide(id: string): Promise<void>;
}

export const SABLONY: { hodnota: SlideTemplate; popis: string; kJedlam: boolean }[] = [
  { hodnota: "akcia", popis: "Akcia", kJedlam: true },
  { hodnota: "uvitanie", popis: "Uvítanie", kJedlam: false },
];

export const VARIANTY: { hodnota: SlideVariant; popis: string }[] = [
  { hodnota: "papier", popis: "Papier" },
  { hodnota: "tmava", popis: "Tmavá" },
  { hodnota: "oranzova", popis: "Oranžová" },
];

export const ANIMACIE: { hodnota: SlideAnimation; popis: string }[] = [
  { hodnota: "ziadna", popis: "Bez animácie" },
  { hodnota: "nastup", popis: "Jemný nástup" },
  { hodnota: "text", popis: "Odkrývanie textu" },
  { hodnota: "zoom", popis: "Pomalý zoom" },
];

export function prazdneFields(t: SlideTemplate): SlideFields {
  return t === "akcia"
    ? { nadpis: "", nadpisEn: "", dishIds: [], akciovaCena: "", podtext: "", podtextEn: "" }
    : { nazov: "", kana: "", podtitul: "", podtitulEn: "", zobrazitHodiny: true };
}
```

- [ ] **Step 4: Spusti testy**

Run: `npm test`
Expected: PASS, 3 nové testy

- [ ] **Step 5: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 6: Commit**

```bash
git add lib/slides/types.ts tests/slides-types.test.ts
git commit -m "Tvary slidov a rozhranie SlideStore"
```

---

### Task 2: Hľadanie jedál a prázdny slide

**Files:**
- Create: `lib/slides/jedla.ts`
- Test: `tests/slides-jedla.test.ts`

- [ ] **Step 1: Napíš padajúce testy**

`tests/slides-jedla.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { najdiJedla, jeSlidePrazdny } from "@/lib/slides/jedla";
import type { Slide } from "@/lib/slides/types";
import type { MenuData } from "@/lib/menu";

const jedlo = (id: string, name: string) =>
  ({
    id, name, parts: [], partsEn: [], price: 100, allergens: [], labels: [],
    options: [], available: true, category: "RAMEN", categoryId: "c1",
  }) as unknown as MenuData["main"] extends null ? never : never;

const menu = {
  left: [{ id: "g1", name: "CHUŤOVKY", dishes: [jedlo("a", "Edamame")] }],
  main: { name: "RAMEN", dishes: [jedlo("b", "NARUTO")] },
  right: [],
} as unknown as MenuData;

const akcia = (dishIds: string[]): Slide => ({
  id: "s1", name: "Akcia", template: "akcia", variant: "papier",
  animation: "ziadna", updatedAt: 1,
  fields: { nadpis: "AKCE", nadpisEn: "", dishIds, akciovaCena: "", podtext: "", podtextEn: "" },
});

describe("najdiJedla", () => {
  it("nájde jedlá naprieč všetkými kategóriami", () => {
    expect(najdiJedla(menu, ["b", "a"]).map((d) => d.name)).toEqual(["NARUTO", "Edamame"]);
  });

  it("jedlo, ktoré už v menu nie je, ticho vynechá", () => {
    expect(najdiJedla(menu, ["a", "zmizlo"]).map((d) => d.name)).toEqual(["Edamame"]);
  });

  it("bez menu vráti prázdno a nespadne", () => {
    expect(najdiJedla(null, ["a"])).toEqual([]);
  });
});

describe("jeSlidePrazdny", () => {
  it("akcia bez existujúcich jedál je prázdna", () => {
    expect(jeSlidePrazdny(akcia(["zmizlo"]), menu)).toBe(true);
  });

  it("akcia s aspoň jedným jedlom prázdna nie je", () => {
    expect(jeSlidePrazdny(akcia(["a", "zmizlo"]), menu)).toBe(false);
  });

  it("uvítanie nie je prázdne nikdy — nestojí na jedlách", () => {
    const u: Slide = {
      id: "s2", name: "Uvítanie", template: "uvitanie", variant: "papier",
      animation: "ziadna", updatedAt: 1,
      fields: { nazov: "RAMEN", kana: "", podtitul: "", podtitulEn: "", zobrazitHodiny: true },
    };
    expect(jeSlidePrazdny(u, menu)).toBe(false);
    expect(jeSlidePrazdny(u, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/slides/jedla'`

- [ ] **Step 3: Napíš `lib/slides/jedla.ts`**

```ts
import type { Dish, MenuData } from "@/lib/menu";
import type { FieldsAkcia, Slide } from "./types";

/**
 * Jedlá zo slidu vyhľadá v živých dátach z ChoiceQR. Poradie drží podľa
 * `dishIds`, nie podľa menu — klient si ho v slide určuje sám.
 *
 * Jedlo, ktoré sa nenájde, sa TICHO vynechá. Klient mení menu často a slide
 * sa nesmie kvôli tomu ukázať rozbitý.
 */
export function najdiJedla(menu: MenuData | null, ids: string[]): Dish[] {
  if (!menu) return [];
  const vsetky = new Map<string, Dish>();
  for (const g of menu.left) for (const d of g.dishes) vsetky.set(d.id, d);
  for (const g of menu.right) for (const d of g.dishes) vsetky.set(d.id, d);
  for (const d of menu.main?.dishes ?? []) vsetky.set(d.id, d);
  return ids.map((id) => vsetky.get(id)).filter((d): d is Dish => !!d);
}

/**
 * Slide, ktorý stojí na jedlách a ani jedno z nich už v menu nie je, nemá čo
 * ukázať. Televízor ho preskočí — lepšie než prázdny rámec cez celú stenu.
 *
 * Uvítanie na jedlách nestojí, takže prázdne nie je nikdy.
 */
export function jeSlidePrazdny(slide: Slide, menu: MenuData | null): boolean {
  if (slide.template !== "akcia") return false;
  const f = slide.fields as FieldsAkcia;
  if (f.dishIds.length === 0) return false;
  return najdiJedla(menu, f.dishIds).length === 0;
}
```

- [ ] **Step 4: Spusti testy**

Run: `npm test`
Expected: PASS, 6 nových testov

- [ ] **Step 5: Commit**

```bash
git add lib/slides tests/slides-jedla.test.ts
git commit -m "Hľadanie jedál v slide a rozpoznanie prázdneho slidu"
```

---

### Task 3: Tabuľka v Supabase

**Files:**
- Create: `supabase/02-slidy.sql`

- [ ] **Step 1: Napíš `supabase/02-slidy.sql`**

```sql
-- Tabuľka slidov. Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.

create table if not exists public.slides (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  template   text not null check (template in ('akcia', 'uvitanie', 'oznamenie', 'novinka')),
  variant    text not null default 'papier'
             check (variant in ('papier', 'tmava', 'oranzova')),
  animation  text not null default 'ziadna'
             check (animation in ('ziadna', 'nastup', 'text', 'zoom')),
  fields     jsonb not null default '{}'::jsonb,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint
);

-- `oznamenie` a `novinka` sú v obmedzení už teraz, aby sa pri 2. etape
-- nemusela meniť schéma. Kód ich zatiaľ neponúka.

-- updated_at musí VŽDY narásť — televízor podľa nej pozná zmenu a dve úpravy
-- v tej istej milisekunde by inak boli neviditeľné. Záruka patrí do databázy,
-- nie do aplikácie.
create or replace function public.slides_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := greatest(
    (extract(epoch from clock_timestamp()) * 1000)::bigint,
    old.updated_at + 1
  );
  return new;
end;
$$;

drop trigger if exists slides_bump_updated_at on public.slides;
create trigger slides_bump_updated_at
  before update on public.slides
  for each row execute function public.slides_bump_updated_at();

-- Zapnuté bez politík = cez verejný anon kľúč sa k dátam nikto nedostane.
-- Aplikácia siaha na tabuľku výhradne zo servera service role kľúčom.
alter table public.slides enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/02-slidy.sql
git commit -m "Schéma tabuľky slides"
```

- [ ] **Step 3: Povedz Marekovi, nech to spustí**

Tabuľku vytvorí Marek v Supabase SQL Editore. Kým to neurobí, `SlideStore` nad Supabase nebude fungovať — lokálna implementácia (Task 4) áno, takže vývoj to nezastaví.

---

### Task 4: Lokálne úložisko slidov

**Files:**
- Create: `lib/slides/local.ts`
- Create: `lib/slides/index.ts`
- Test: `tests/slides-store.test.ts`

- [ ] **Step 1: Napíš padajúce testy**

`tests/slides-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLocalSlideStore } from "@/lib/slides/local";
import { SlideNotFoundError } from "@/lib/slides/types";
import type { SlideStore } from "@/lib/slides/types";

let dir: string;
let store: SlideStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tvslides-"));
  store = createLocalSlideStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("úložisko slidov", () => {
  it("na prázdnom úložisku vráti prázdny zoznam", async () => {
    expect(await store.listSlides()).toEqual([]);
  });

  it("vytvorí slide s prázdnymi poliami podľa šablóny", async () => {
    const s = await store.createSlide({ name: "Akcia dne", template: "akcia" });
    expect(s.id).toBeTruthy();
    expect(s.variant).toBe("papier");
    expect(s.animation).toBe("ziadna");
    expect(s.fields).toEqual({
      nadpis: "", nadpisEn: "", dishIds: [], akciovaCena: "", podtext: "", podtextEn: "",
    });
  });

  it("úprava posunie updatedAt", async () => {
    const s = await store.createSlide({ name: "A", template: "uvitanie" });
    const po = await store.updateSlide(s.id, { variant: "tmava" });
    expect(po.variant).toBe("tmava");
    expect(po.updatedAt).toBeGreaterThan(s.updatedAt);
  });

  it("úprava neexistujúceho slidu padne", async () => {
    await expect(store.updateSlide("nieje", { name: "X" })).rejects.toThrow(
      SlideNotFoundError,
    );
  });

  it("getSlidesByIds vráti len nájdené a v poradí zoznamu", async () => {
    const a = await store.createSlide({ name: "A", template: "akcia" });
    const b = await store.createSlide({ name: "B", template: "uvitanie" });
    const najdene = await store.getSlidesByIds([b.id, "nieje", a.id]);
    expect(najdene.map((s) => s.name)).toEqual(["B", "A"]);
  });

  it("zmazanie slide odstráni", async () => {
    const s = await store.createSlide({ name: "A", template: "akcia" });
    await store.deleteSlide(s.id);
    expect(await store.getSlide(s.id)).toBeNull();
  });

  it("dáta prežijú nový store nad tým istým priečinkom", async () => {
    await store.createSlide({ name: "A", template: "akcia" });
    expect(await createLocalSlideStore(dir).listSlides()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/slides/local'`

- [ ] **Step 3: Napíš `lib/slides/local.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  SlideNotFoundError,
  prazdneFields,
  type NewSlide,
  type Slide,
  type SlidePatch,
  type SlideStore,
} from "./types";

type Data = { slides: Slide[] };

/**
 * Úložisko slidov nad jedným JSON súborom — na vývoj bez databázy.
 * Zápis ide cez dočasný súbor a premenovanie, aby súbor neostal
 * poloprepísaný, keby sa proces vypol uprostred.
 */
export function createLocalSlideStore(dir: string): SlideStore {
  const file = path.join(dir, "slides.json");

  async function read(): Promise<Data> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Data;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { slides: [] };
      throw new Error(`Úložisko slidov sa nedá prečítať: ${file}`);
    }
  }

  async function write(data: Data): Promise<void> {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, file);
  }

  return {
    async listSlides() {
      const { slides } = await read();
      return [...slides].sort((a, b) => a.name.localeCompare(b.name, "sk"));
    },

    async getSlide(id) {
      return (await read()).slides.find((s) => s.id === id) ?? null;
    },

    async getSlidesByIds(ids) {
      const { slides } = await read();
      return ids
        .map((id) => slides.find((s) => s.id === id))
        .filter((s): s is Slide => !!s);
    },

    async createSlide(input: NewSlide) {
      const data = await read();
      const slide: Slide = {
        id: randomUUID(),
        name: input.name,
        template: input.template,
        variant: "papier",
        animation: "ziadna",
        fields: prazdneFields(input.template),
        updatedAt: Date.now(),
      };
      data.slides.push(slide);
      await write(data);
      return slide;
    },

    async updateSlide(id, patch: SlidePatch) {
      const data = await read();
      const i = data.slides.findIndex((s) => s.id === id);
      if (i === -1) throw new SlideNotFoundError();
      const updated: Slide = {
        ...data.slides[i],
        ...patch,
        updatedAt: Math.max(Date.now(), data.slides[i].updatedAt + 1),
      };
      data.slides[i] = updated;
      await write(data);
      return updated;
    },

    async deleteSlide(id) {
      const data = await read();
      data.slides = data.slides.filter((s) => s.id !== id);
      await write(data);
    },
  };
}
```

- [ ] **Step 4: Napíš `lib/slides/index.ts`**

```ts
import path from "node:path";
import { createLocalSlideStore } from "./local";
import { createSupabaseSlideStore } from "./supabase";
import type { SlideStore } from "./types";

let instance: SlideStore | null = null;

/**
 * Jediné miesto, kde sa rozhoduje, kam sa slidy ukladajú. Keď sú nastavené
 * prístupové údaje k Supabase, ide tam; inak do súboru — aby sa dalo vyvíjať
 * aj bez databázy.
 */
export function getSlideStore(): SlideStore {
  if (!instance) {
    const url = process.env.SUPABASE_URL;
    const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    instance =
      url && kluc
        ? createSupabaseSlideStore(url, kluc)
        : createLocalSlideStore(
            process.env.TV_DATA_DIR ?? path.join(process.cwd(), ".data"),
          );
  }
  return instance;
}
```

Pozn.: `./supabase` vznikne až v Task 5 — dovtedy `tsc` na tomto súbore zahlási chýbajúci modul. Preto ho commituj až spolu s Task 5; `local.ts` a testy commitni teraz.

- [ ] **Step 5: Spusti testy**

Run: `npm test`
Expected: PASS, 7 nových testov

- [ ] **Step 6: Commit (bez `index.ts`)**

```bash
git add lib/slides/local.ts tests/slides-store.test.ts
git commit -m "Lokálne úložisko slidov"
```

---

### Task 5: Úložisko slidov nad Supabase

**Files:**
- Create: `lib/slides/supabase.ts`
- Commit aj: `lib/slides/index.ts` (napísaný v Task 4)

- [ ] **Step 1: Napíš `lib/slides/supabase.ts`**

```ts
import {
  SlideNotFoundError,
  prazdneFields,
  type NewSlide,
  type Slide,
  type SlidePatch,
  type SlideStore,
  type SlideTemplate,
} from "./types";

type Riadok = {
  id: string;
  name: string;
  template: SlideTemplate;
  variant: Slide["variant"];
  animation: Slide["animation"];
  fields: Slide["fields"] | null;
  updated_at: number;
};

/** V databáze `updated_at`, v TypeScripte `updatedAt`. Prázdne polia dopĺňame. */
function naSlide(r: Riadok): Slide {
  return {
    id: r.id,
    name: r.name,
    template: r.template,
    variant: r.variant,
    animation: r.animation,
    fields:
      r.fields && Object.keys(r.fields).length > 0
        ? r.fields
        : prazdneFields(r.template),
    updatedAt: Number(r.updated_at),
  };
}

export function createSupabaseSlideStore(url: string, serviceKey: string): SlideStore {
  const zaklad = `${url}/rest/v1/slides`;
  const hlavicky = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  async function ziadost(cesta: string, init?: RequestInit): Promise<Riadok[]> {
    const r = await fetch(zaklad + cesta, {
      ...init,
      headers: { ...hlavicky, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const telo = await r.text();
    if (!r.ok) {
      throw new Error(`Supabase slides ${r.status}: ${telo.slice(0, 200)}`);
    }
    return telo ? (JSON.parse(telo) as Riadok[]) : [];
  }

  return {
    async listSlides() {
      return (await ziadost("?select=*&order=name.asc")).map(naSlide);
    },

    async getSlide(id) {
      // Nezmyselné id (nie uuid) vráti Postgres ako chybu tvaru — pre volajúceho
      // je to ale proste „neexistuje", nie porucha.
      try {
        const r = await ziadost(`?id=eq.${encodeURIComponent(id)}&select=*`);
        return r[0] ? naSlide(r[0]) : null;
      } catch {
        return null;
      }
    },

    async getSlidesByIds(ids) {
      if (ids.length === 0) return [];
      const zoznam = ids.map((i) => `"${i}"`).join(",");
      let riadky: Riadok[] = [];
      try {
        riadky = await ziadost(`?id=in.(${zoznam})&select=*`);
      } catch {
        return [];
      }
      const podla = new Map(riadky.map((r) => [r.id, naSlide(r)]));
      // Poradie drží zoznam, ktorý prišiel — nie databáza.
      return ids.map((id) => podla.get(id)).filter((s): s is Slide => !!s);
    },

    async createSlide(input: NewSlide) {
      const r = await ziadost("", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name: input.name,
          template: input.template,
          variant: "papier",
          animation: "ziadna",
          fields: prazdneFields(input.template),
        }),
      });
      return naSlide(r[0]);
    },

    async updateSlide(id, patch: SlidePatch) {
      // `updatedAt` neposielame, dvíha ho databázový trigger.
      const telo = Object.keys(patch).length > 0 ? patch : { id };
      let r: Riadok[];
      try {
        r = await ziadost(`?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(telo),
        });
      } catch {
        throw new SlideNotFoundError();
      }
      if (!r[0]) throw new SlideNotFoundError();
      return naSlide(r[0]);
    },

    async deleteSlide(id) {
      await ziadost(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
```

- [ ] **Step 2: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 3: Spusti testy**

Run: `npm test`
Expected: PASS, rovnaký počet ako po Task 4

- [ ] **Step 4: Commit**

```bash
git add lib/slides/supabase.ts lib/slides/index.ts
git commit -m "Úložisko slidov nad Supabase"
```

---

### Task 6: Šablóny — vzhľad

**Files:**
- Create: `app/slides/slides.css`

- [ ] **Step 1: Napíš `app/slides/slides.css`**

```css
/* Vzhľad slidov. Ten istý súbor slúži televízoru aj náhľadu v adminovi —
   preto sa nikde nespolieha na výšku okna, ale na vlastný kontajner.
   Rozmery sú v `cqh`/`cqw` (podiel kontajnera), aby náhľad v adminovi
   vyzeral presne ako obraz na televízore, len menší. */

.slide {
  container-type: size;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  font-family: Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* ---- farebné varianty ---- */
/* Pevné dvojice z vizuálu reštaurácie. Klient si nevie zvoliť nič, čo zhučí. */
.slide--papier   { --s-poz: #f4f2ec; --s-text: #14110f; --s-zvyr: #a8500c; }
.slide--tmava    { --s-poz: #14110f; --s-text: #f4f2ec; --s-zvyr: #d9741a; }
.slide--oranzova { --s-poz: #a8500c; --s-text: #f9f5ee; --s-zvyr: #14110f; }

.slide {
  background: var(--s-poz);
  color: var(--s-text);
}

/* ---- spoločné prvky ---- */

.slide__telo {
  padding: 7cqh 7cqw;
  display: flex;
  flex-direction: column;
  gap: 3cqh;
}

.slide__nadpis {
  font-family: "Roboto Condensed", Roboto, Arial, sans-serif;
  font-weight: 700;
  font-size: 11cqh;
  line-height: 1.05;
  letter-spacing: 0.03em;
}

.slide__nadpis-en {
  font-size: 3.4cqh;
  letter-spacing: 0.28em;
  opacity: 0.6;
  margin-top: -1.5cqh;
}

.slide__kana {
  font-family: "Noto Sans JP", sans-serif;
  font-size: 5cqh;
  letter-spacing: 0.3em;
  color: var(--s-zvyr);
}

.slide__podtext { font-size: 4cqh; opacity: 0.75; }
.slide__podtext-en { font-size: 2.8cqh; letter-spacing: 0.18em; opacity: 0.5; }

.slide__linka {
  height: 0.35cqh;
  background: currentColor;
  opacity: 0.18;
}

/* ---- jedlá ---- */

.slide__jedla { display: flex; flex-direction: column; gap: 2.4cqh; }

.slide__jedlo {
  display: flex;
  align-items: baseline;
  gap: 2cqw;
}

.slide__jedlo-nazov {
  font-family: "Roboto Condensed", Roboto, Arial, sans-serif;
  font-weight: 700;
  font-size: 6cqh;
  flex: 1 1 auto;
  min-width: 0;
}

.slide__jedlo-popis {
  font-size: 3cqh;
  opacity: 0.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slide__cena { font-size: 6cqh; font-weight: 700; color: var(--s-zvyr); white-space: nowrap; }
.slide__cena--stara {
  font-size: 4cqh;
  font-weight: 400;
  text-decoration: line-through;
  opacity: 0.45;
  color: inherit;
}

/* ---- na výšku: všetko na stred a pod seba ---- */

.slide--portrait .slide__telo { text-align: center; gap: 4cqh; }
.slide--portrait .slide__jedlo { flex-direction: column; align-items: center; gap: 1cqh; }
.slide--portrait .slide__nadpis { font-size: 8cqh; }
.slide--portrait .slide__jedlo-nazov { font-size: 5cqh; }
.slide--portrait .slide__cena { font-size: 5.5cqh; }

/* ---- animácie ---- */
/* Len `opacity` a `transform` — nič iné sa na televízore nehýbe plynulo.
   Bežia raz pri nástupe slidu, nie dokola: televízor svieti celý deň. */

@keyframes slide-nastup {
  from { opacity: 0; transform: translateY(2cqh); }
  to   { opacity: 1; transform: none; }
}

@keyframes slide-zoom {
  from { transform: scale(1.04); }
  to   { transform: scale(1); }
}

.slide--anim-nastup .slide__telo { animation: slide-nastup 900ms ease both; }
.slide--anim-zoom { animation: slide-zoom 9s ease-out both; }

/* Odkrývanie textu: prvky nastupujú po sebe. Poradie určuje `--poradie`,
   ktoré nastavuje komponent. */
.slide--anim-text .slide__telo > * {
  animation: slide-nastup 700ms ease both;
  animation-delay: calc(var(--poradie, 0) * 160ms);
}

@media (prefers-reduced-motion: reduce) {
  .slide--anim-nastup .slide__telo,
  .slide--anim-zoom,
  .slide--anim-text .slide__telo > * { animation: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/slides/slides.css
git commit -m "Vzhľad slidov: varianty, obe orientácie, animácie"
```

---

### Task 7: Šablóny Akcia a Uvítanie

**Files:**
- Create: `app/slides/akcia.tsx`
- Create: `app/slides/uvitanie.tsx`
- Create: `app/slides/slide-view.tsx`

- [ ] **Step 1: Napíš `app/slides/akcia.tsx`**

```tsx
import { najdiJedla } from "@/lib/slides/jedla";
import type { MenuData } from "@/lib/menu";
import type { FieldsAkcia, Slide } from "@/lib/slides/types";

/**
 * Akcia: nadpis, jedlá zo živého ChoiceQR a voliteľná zľavnená cena.
 * Bežná cena sa ťahá z menu, zľavnenú píše klient — ChoiceQR ju nepozná.
 */
export default function Akcia({
  slide,
  menu,
  currency,
}: {
  slide: Slide;
  menu: MenuData | null;
  currency: string;
}) {
  const f = slide.fields as FieldsAkcia;
  const jedla = najdiJedla(menu, f.dishIds);
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as React.CSSProperties;

  return (
    <div className="slide__telo">
      {f.nadpis && (
        <div style={dalsie()}>
          <div className="slide__nadpis">{f.nadpis}</div>
          {f.nadpisEn && <div className="slide__nadpis-en">{f.nadpisEn}</div>}
        </div>
      )}

      {jedla.length > 0 && <div className="slide__linka" style={dalsie()} />}

      {jedla.length > 0 && (
        <div className="slide__jedla" style={dalsie()}>
          {jedla.map((d) => (
            <div className="slide__jedlo" key={d.id}>
              <span className="slide__jedlo-nazov">
                {d.name}
                {d.parts.length > 0 && (
                  <span className="slide__jedlo-popis">{d.parts.join(", ")}</span>
                )}
              </span>
              {f.akciovaCena ? (
                <>
                  <span className="slide__cena slide__cena--stara">
                    {d.price} {currency}
                  </span>
                  <span className="slide__cena">
                    {f.akciovaCena} {currency}
                  </span>
                </>
              ) : (
                <span className="slide__cena">
                  {d.price} {currency}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {f.podtext && (
        <div style={dalsie()}>
          <div className="slide__podtext">{f.podtext}</div>
          {f.podtextEn && <div className="slide__podtext-en">{f.podtextEn}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Napíš `app/slides/uvitanie.tsx`**

```tsx
import type { MenuData } from "@/lib/menu";
import type { FieldsUvitanie, Slide } from "@/lib/slides/types";

/**
 * Uvítanie: názov podniku, japonská ozdoba, podtitul a voliteľne otváracia
 * doba. Hodiny sa ťahajú živo z ChoiceQR — klient ich nikde neprepisuje.
 */
export default function Uvitanie({
  slide,
  menu,
}: {
  slide: Slide;
  menu: MenuData | null;
}) {
  const f = slide.fields as FieldsUvitanie;
  const hodiny =
    f.zobrazitHodiny && menu?.workTime
      ? `${menu.workTime.from.slice(0, 5)} — ${menu.workTime.till.slice(0, 5)}`
      : null;
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as React.CSSProperties;

  return (
    <div className="slide__telo">
      {f.nazov && (
        <div className="slide__nadpis" style={dalsie()}>
          {f.nazov}
        </div>
      )}
      {f.kana && (
        <div className="slide__kana" style={dalsie()}>
          {f.kana}
        </div>
      )}
      {f.podtitul && (
        <div style={dalsie()}>
          <div className="slide__podtext">{f.podtitul}</div>
          {f.podtitulEn && <div className="slide__podtext-en">{f.podtitulEn}</div>}
        </div>
      )}
      {hodiny && (
        <div style={dalsie()}>
          <div className="slide__linka" />
          <div className="slide__nadpis" style={{ fontSize: "7cqh", marginTop: "2cqh" }}>
            {hodiny}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Napíš `app/slides/slide-view.tsx`**

```tsx
import Akcia from "./akcia";
import Uvitanie from "./uvitanie";
import type { MenuData } from "@/lib/menu";
import type { Orientation } from "@/lib/storage/types";
import type { Slide } from "@/lib/slides/types";
import "./slides.css";

/**
 * Rozcestník šablón. TEN ISTÝ komponent kreslí náhľad v adminovi aj obraz na
 * televízore — čo klient vidí pri tvorbe, to naozaj dostane. Preto sa tu
 * nikde nepočíta s výškou okna, len s veľkosťou vlastného kontajnera.
 */
export default function SlideView({
  slide,
  menu,
  orientation,
  currency = "Kč",
}: {
  slide: Slide;
  menu: MenuData | null;
  orientation: Orientation;
  currency?: string;
}) {
  const triedy = [
    "slide",
    `slide--${slide.variant}`,
    `slide--${orientation}`,
    `slide--anim-${slide.animation}`,
  ].join(" ");

  return (
    <div className={triedy}>
      {slide.template === "akcia" ? (
        <Akcia slide={slide} menu={menu} currency={currency} />
      ) : (
        <Uvitanie slide={slide} menu={menu} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 5: Commit**

```bash
git add app/slides
git commit -m "Šablóny Akcia a Uvítanie pre obe orientácie"
```

---

### Task 8: Slide ako typ položky v slede

**Files:**
- Modify: `lib/storage/types.ts`
- Modify: `lib/storage/local.ts`
- Modify: `lib/storage/supabase.ts`
- Modify: `app/api/admin/screens/[id]/route.ts`
- Modify: `tests/store-kontrakt.ts`

- [ ] **Step 1: V `lib/storage/types.ts` rozšír `ItemKind` a `PlaylistItem`**

Nájdi `export type ItemKind` a zmeň ho na:

```ts
export type ItemKind = "menu" | "image" | "video" | "slide";
```

Do `PlaylistItem` za `repeats` pridaj:

```ts
  /** len pri `slide`: odkaz do tabuľky slidov; inde prázdny reťazec */
  slideId: string;
```

- [ ] **Step 2: Dopln predvolenú hodnotu v `lib/storage/local.ts`**

V mieste, kde sa dopĺňa `repeats` (funkcia `dopln` vo `read()`), pridaj aj:

```ts
      slideId: typeof i.slideId === "string" ? i.slideId : "",
```

- [ ] **Step 3: To isté v `lib/storage/supabase.ts`**

V prevode riadka na `Screen`, kde sa dopĺňa `repeats`, pridaj rovnaký riadok:

```ts
      slideId: typeof i.slideId === "string" ? i.slideId : "",
```

- [ ] **Step 4: Validuj v `app/api/admin/screens/[id]/route.ts`**

V mapovaní `items` pridaj do vytváraného objektu:

```ts
        slideId: it.kind === "slide" ? String(it.slideId ?? "") : "",
```

a do zoznamu povolených hodnôt `kind` doplň `"slide"` — nájdi
`it.kind === "image" || it.kind === "video" ? it.kind : "menu"` a zmeň na:

```ts
        kind:
          it.kind === "image" || it.kind === "video" || it.kind === "slide"
            ? it.kind
            : "menu",
```

- [ ] **Step 5: Dopln `slideId` do literálov v `tests/store-kontrakt.ts`**

Všade, kde test skladá `PlaylistItem`, pridaj `slideId: ""` — inak nesedí typ.

- [ ] **Step 6: Spusti testy a preklad**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, bez chýb

- [ ] **Step 7: Commit**

```bash
git add lib/storage app/api/admin/screens tests/store-kontrakt.ts
git commit -m "Slide ako typ položky v slede"
```

---

### Task 9: Verejná routa vracia aj slidy — POZOR, mení tvar

Dnes `GET /api/screens/<slug>` vracia obrazovku priamo. Po novom ju zabalí
spolu so slidmi, ktoré jej sled používa. **Routa aj prehrávač sa musia zmeniť
naraz** — inak televízory po nasadení zhasnú.

**Files:**
- Modify: `app/api/screens/[slug]/route.ts`
- Modify: `app/tv/[slug]/page.tsx`
- Modify: `app/tv/[slug]/player.tsx`

- [ ] **Step 1: Prepíš `app/api/screens/[slug]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { getSlideStore } from "@/lib/slides";

export const dynamic = "force-dynamic";

/**
 * Nastavenia obrazovky pre TV vrátane slidov, ktoré jej sled používa.
 * Verejné a len na čítanie — TV sa neprihlasuje.
 *
 * Slidy chodia spolu s obrazovkou zámerne: televízor si vystačí s jedným
 * dopytom a úprava slidu sa naň dostane tým istým 15-sekundovým dopytom,
 * ktorý už beží kvôli nastaveniam.
 *
 * Bez cache, inak by sa zmena z adminu na TV prejavila neskoro alebo vôbec.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const screen = await getStore().getScreenBySlug(slug);
  if (!screen) {
    return NextResponse.json({ error: "Obrazovka neexistuje" }, { status: 404 });
  }

  const ids = screen.items
    .filter((i) => i.kind === "slide" && i.slideId)
    .map((i) => i.slideId);
  const slides = Object.fromEntries(
    (await getSlideStore().getSlidesByIds(ids)).map((s) => [s.id, s]),
  );

  return NextResponse.json(
    { screen, slides },
    { headers: { "cache-control": "no-store" } },
  );
}
```

- [ ] **Step 2: Prepíš `app/tv/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getStore } from "@/lib/storage";
import { getSlideStore } from "@/lib/slides";
import Player from "./player";

export const dynamic = "force-dynamic";

export default async function TvPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const screen = await getStore().getScreenBySlug(slug);
  if (!screen) notFound();

  const ids = screen.items
    .filter((i) => i.kind === "slide" && i.slideId)
    .map((i) => i.slideId);
  const slides = Object.fromEntries(
    (await getSlideStore().getSlidesByIds(ids)).map((s) => [s.id, s]),
  );

  return <Player initial={screen} initialSlides={slides} />;
}
```

- [ ] **Step 3: V `app/tv/[slug]/player.tsx` prijmi slidy a čítaj nový tvar**

Zmeň hlavičku komponentu:

```tsx
export default function Player({
  initial,
  initialSlides,
}: {
  initial: Screen;
  initialSlides: Record<string, Slide>;
}) {
  const [screen, setScreen] = useState(initial);
  const [slides, setSlides] = useState(initialSlides);
```

pridaj import:

```tsx
import type { Slide } from "@/lib/slides/types";
```

a v dopyte na nastavenia zmeň spracovanie odpovede — dnes je tam
`const fresh = (await r.json()) as Screen;`, nahraď celý blok týmto:

```tsx
        const data = (await r.json()) as { screen: Screen; slides: Record<string, Slide> };
        setScreen((stary) =>
          data.screen.updatedAt !== stary.updatedAt ? data.screen : stary,
        );
        // Slidy sa menia nezávisle od obrazovky — porovnávame ich zvlášť,
        // inak by úprava slidu na TV nedošla, kým sa nezmení aj obrazovka.
        setSlides((stare) => {
          const novy = JSON.stringify(data.slides);
          return novy === JSON.stringify(stare) ? stare : data.slides;
        });
```

- [ ] **Step 4: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 5: Over, že televízor ďalej beží**

Dev server na porte 4000. `curl` je blokovaný — použi
`mcp__plugin_context-mode_context-mode__ctx_execute` s `fetch`:

- `GET http://localhost:4000/tv/hlavna` → 200
- `GET http://localhost:4000/api/screens/hlavna` → 200 a telo má kľúče `screen` aj `slides`

- [ ] **Step 6: Commit**

```bash
git add app/api/screens app/tv
git commit -m "Verejná routa vracia obrazovku aj jej slidy"
```

---

### Task 10: Prehrávač vykreslí slide a prázdny preskočí

**Files:**
- Modify: `app/tv/[slug]/player.tsx`

- [ ] **Step 1: Pridaj importy**

```tsx
import SlideView from "@/app/slides/slide-view";
import { jeSlidePrazdny } from "@/lib/slides/jedla";
```

- [ ] **Step 2: Vykresli položku typu `slide`**

V mape položiek, kde sa dnes rozhoduje medzi `menu`, `video` a obrázkom,
pridaj vetvu pre slide — pred vetvu s obrázkom:

```tsx
          ) : it.kind === "slide" ? (
            slides[it.slideId] ? (
              <SlideView
                slide={slides[it.slideId]}
                menu={menu}
                orientation={screen.orientation}
                currency={menu?.currency ?? "Kč"}
              />
            ) : null
          ) : (
```

- [ ] **Step 3: Preskoč prázdny slide**

Do efektu, ktorý prepína položky (ten s `casovac`), pridaj hneď na začiatok
za kontrolu `items.length < 2`:

```tsx
    /* Slide, ktorý stojí na jedlách a ani jedno z nich už v ChoiceQR nie je,
       nemá čo ukázať. Preskočíme ho hneď — prázdny rámec cez celú stenu je
       horší než o položku kratší sled. Klient mení menu často, takže toto
       nastane. */
    const teraz = items[index];
    if (
      teraz?.kind === "slide" &&
      slides[teraz.slideId] &&
      jeSlidePrazdny(slides[teraz.slideId], menu)
    ) {
      const preskoc = setTimeout(() => setIndex((i) => (i + 1) % items.length), 50);
      return () => clearTimeout(preskoc);
    }
```

a do závislostí toho efektu dopln `slides` a `menu`.

- [ ] **Step 4: Over preklad a testy**

Run: `npx tsc --noEmit && npm test`
Expected: bez chýb, 38+ testov zelených

- [ ] **Step 5: Commit**

```bash
git add app/tv
git commit -m "Prehrávač vykreslí slide a prázdny preskočí"
```

---

### Task 11: API adminu pre slidy

**Files:**
- Create: `app/api/admin/slides/route.ts`
- Create: `app/api/admin/slides/[id]/route.ts`

- [ ] **Step 1: Napíš `app/api/admin/slides/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import type { SlideTemplate } from "@/lib/slides/types";

export async function GET() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  return NextResponse.json(await getSlideStore().listSlides());
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    template?: SlideTemplate;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Názov nesmie byť prázdny" }, { status: 400 });
  }
  const template: SlideTemplate = body.template === "uvitanie" ? "uvitanie" : "akcia";
  try {
    return NextResponse.json(
      await getSlideStore().createSlide({ name, template }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Slide sa nepodarilo vytvoriť" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Napíš `app/api/admin/slides/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import {
  SlideNotFoundError,
  type SlideAnimation,
  type SlidePatch,
  type SlideVariant,
} from "@/lib/slides/types";

type Ctx = { params: Promise<{ id: string }> };

const VARIANTY: SlideVariant[] = ["papier", "tmava", "oranzova"];
const ANIMACIE: SlideAnimation[] = ["ziadna", "nastup", "text", "zoom"];

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SlidePatch;
  const patch: SlidePatch = {};

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (VARIANTY.includes(body.variant as SlideVariant)) patch.variant = body.variant;
  if (ANIMACIE.includes(body.animation as SlideAnimation)) patch.animation = body.animation;
  // `fields` berieme ako celok — tvar stráži šablóna v editore aj typy.
  if (body.fields && typeof body.fields === "object") patch.fields = body.fields;

  try {
    return NextResponse.json(await getSlideStore().updateSlide(id, patch));
  } catch (e) {
    if (e instanceof SlideNotFoundError) {
      return NextResponse.json({ error: "Slide neexistuje" }, { status: 404 });
    }
    return NextResponse.json({ error: "Uloženie zlyhalo" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  await getSlideStore().deleteSlide(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Over, že bez prihlásenia nepustí**

Cez `ctx_execute` s `fetch`: `GET http://localhost:4000/api/admin/slides` bez cookie
Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/slides
git commit -m "API adminu na správu slidov"
```

---

### Task 12: Sekcia Slidy v adminovi — zoznam

**Files:**
- Modify: `app/admin/layout.tsx`
- Create: `app/admin/slides/page.tsx`
- Create: `app/admin/slides/slides-list.tsx`

- [ ] **Step 1: Do `app/admin/layout.tsx` pridaj prepínanie sekcií**

Do obalu nad `{children}` vlož navigáciu (trieda `admin__nav` sa dostýluje
v ďalšom kroku):

```tsx
      <nav className="admin__nav">
        <a href="/admin">Obrazovky</a>
        <a href="/admin/slides">Slidy</a>
      </nav>
```

- [ ] **Step 2: Dostýluj ju v `app/admin/admin.css`**

Na koniec súboru:

```css
/* Prepínanie medzi sekciami adminu. Leží na tmavom obale, nie na karte. */
.admin__nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.admin__nav a {
  flex: 1 1 0;
  text-align: center;
  padding: 0.85rem 1rem;
  border-radius: 0.7rem;
  background: var(--a-cierna-2);
  color: var(--a-papier);
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid rgba(250, 247, 240, 0.08);
}
.admin__nav a:hover { border-color: var(--a-oranz); }
```

- [ ] **Step 3: Napíš `app/admin/slides/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSlideStore } from "@/lib/slides";
import { getMenu } from "@/lib/menu";
import { isLoggedIn } from "@/lib/session";
import SlidesList from "./slides-list";

export const dynamic = "force-dynamic";

export default async function SlidesPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");

  // Menu kvôli náhľadom v zozname — keď ChoiceQR neodpovedá, zoznam musí
  // fungovať aj bez neho.
  let menu = null;
  try {
    menu = await getMenu();
  } catch {
    menu = null;
  }

  return <SlidesList initial={await getSlideStore().listSlides()} menu={menu} />;
}
```

- [ ] **Step 4: Napíš `app/admin/slides/slides-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import SlideView from "@/app/slides/slide-view";
import type { MenuData } from "@/lib/menu";
import { SABLONY, type Slide, type SlideTemplate } from "@/lib/slides/types";

export default function SlidesList({
  initial,
  menu,
}: {
  initial: Slide[];
  menu: MenuData | null;
}) {
  const [slides, setSlides] = useState(initial);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<SlideTemplate>("akcia");
  const [chyba, setChyba] = useState("");

  async function pridaj(e: React.FormEvent) {
    e.preventDefault();
    setChyba("");
    const r = await fetch("/api/admin/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, template }),
    });
    const d = await r.json();
    if (!r.ok) {
      setChyba(d.error ?? "Nepodarilo sa");
      return;
    }
    setSlides((s) => [...s, d as Slide]);
    setName("");
  }

  async function zmaz(s: Slide) {
    if (!confirm(`Naozaj zmazať „${s.name}"? Zo sledov ho treba odobrať zvlášť.`)) return;
    await fetch(`/api/admin/slides/${s.id}`, { method: "DELETE" });
    setSlides((z) => z.filter((x) => x.id !== s.id));
  }

  const popisSablony = (t: SlideTemplate) =>
    SABLONY.find((s) => s.hodnota === t)?.popis ?? t;

  return (
    <>
      <header className="hlavicka">
        <div>
          <h1>Slidy</h1>
          <p className="hlavicka__popis">VLASTNÉ OBRAZOVKY</p>
        </div>
      </header>

      {slides.length === 0 && (
        <p className="ticho">Zatiaľ žiadny slide. Vytvor prvý nižšie.</p>
      )}

      {slides.map((s, i) => (
        <div className="karta" key={s.id} style={{ "--i": i } as React.CSSProperties}>
          <div className="hlava-karty">
            <h2>{s.name}</h2>
            <span className="odznak">{popisSablony(s.template)}</span>
          </div>
          {/* Náhľad priamo v zozname — klient tak vidí, čo ktorý slide je,
              bez toho aby ho musel otvárať. */}
          <div className="nahlad nahlad--landscape">
            <SlideView
              slide={s}
              menu={menu}
              orientation="landscape"
              currency={menu?.currency ?? "Kč"}
            />
          </div>
          <div className="akcie">
            <Link className="tl tl--hlavne" href={`/admin/slides/${s.id}`}>
              Upraviť
            </Link>
            <span className="akcie__medzera" />
            <button className="tl tl--ticho tl--male" onClick={() => zmaz(s)}>
              Zmazať
            </button>
          </div>
        </div>
      ))}

      <form className="karta" onSubmit={pridaj}>
        <h2>Nový slide</h2>
        <label>
          Názov
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="napr. Akcia dne"
          />
        </label>
        <label>
          Šablóna
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as SlideTemplate)}
          >
            {SABLONY.map((s) => (
              <option key={s.hodnota} value={s.hodnota}>
                {s.popis}
              </option>
            ))}
          </select>
        </label>
        {chyba && <p className="chyba">{chyba}</p>}
        <button className="tl tl--hlavne" disabled={!name.trim()}>
          Vytvoriť
        </button>
      </form>
    </>
  );
}
```

Skutočné triedy z redizajnu, ktoré tu použi (overené v `app/admin/admin.css`):
`hlavicka` + `hlavicka__popis`, `karta`, `hlava-karty`, `tl tl--hlavne`,
`tl tl--ticho`, `ticho`, `chyba`, `mriezka`, `lista` + `lista__stav`
(+`--neulozene` / `--ulozene`), `dlazdica` + `dlazdica__stitok`.
Formulárové pole má tvar:

```tsx
<label className="pole">
  <span className="pole__popis">Názov</span>
  <input type="text" value={…} onChange={…} />
</label>
```

Nadpis v karte je obyčajné `<h2>`. Karta dostáva `style={{ "--i": index }}`
kvôli postupnému nástupu. Žiadne nové triedy pre to isté nevytváraj.

- [ ] **Step 5: Vyskúšaj**

Cez `ctx_execute` s `fetch`: prihlás sa (`POST /api/admin/login`,
`{"user":"admin","password":"brno123"}`), potom `GET /admin/slides` s cookie.
Expected: 200 a HTML obsahuje „Nový slide"

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx app/admin/admin.css app/admin/slides
git commit -m "Sekcia Slidy v adminovi so zoznamom"
```

---

### Task 13: Editor slidu s náhľadom naživo

**Files:**
- Create: `app/admin/slides/[id]/page.tsx`
- Create: `app/admin/slides/[id]/editor.tsx`

- [ ] **Step 1: Napíš `app/admin/slides/[id]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getSlideStore } from "@/lib/slides";
import { getMenu } from "@/lib/menu";
import { isLoggedIn } from "@/lib/session";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function SlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const { id } = await params;
  const slide = await getSlideStore().getSlide(id);
  if (!slide) notFound();

  // Menu berieme na serveri, nech je náhľad hneď a s naozaj živými cenami.
  // Keď ChoiceQR práve neodpovedá, editor musí fungovať aj bez neho.
  let menu = null;
  try {
    menu = await getMenu();
  } catch {
    menu = null;
  }

  return <Editor slide={slide} menu={menu} />;
}
```

- [ ] **Step 2: Napíš `app/admin/slides/[id]/editor.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SlideView from "@/app/slides/slide-view";
import type { Dish, MenuData } from "@/lib/menu";
import type { Orientation } from "@/lib/storage/types";
import {
  ANIMACIE,
  VARIANTY,
  type FieldsAkcia,
  type FieldsUvitanie,
  type Slide,
  type SlideAnimation,
  type SlideVariant,
} from "@/lib/slides/types";

/** Odtlačok stavu — podľa neho vieme, či má klient neuložené zmeny. */
const odtlacok = (s: Pick<Slide, "name" | "variant" | "animation" | "fields">) =>
  JSON.stringify(s);

function vsetkyJedla(menu: MenuData | null): Dish[] {
  if (!menu) return [];
  return [
    ...menu.left.flatMap((g) => g.dishes),
    ...(menu.main?.dishes ?? []),
    ...menu.right.flatMap((g) => g.dishes),
  ];
}

export default function Editor({ slide, menu }: { slide: Slide; menu: MenuData | null }) {
  const [name, setName] = useState(slide.name);
  const [variant, setVariant] = useState<SlideVariant>(slide.variant);
  const [animation, setAnimation] = useState<SlideAnimation>(slide.animation);
  const [fields, setFields] = useState(slide.fields);
  const [nahlad, setNahlad] = useState<Orientation>("landscape");
  const [ulozeny, setUlozeny] = useState(() => odtlacok(slide));
  const [stav, setStav] = useState("");

  const teraz = odtlacok({ name, variant, animation, fields });
  const zmenene = teraz !== ulozeny;

  /* Náhľad dostáva presne to, čo pôjde na televízor — nie približnú kópiu. */
  const nahladSlide: Slide = { ...slide, name, variant, animation, fields };

  const jedla = useMemo(() => vsetkyJedla(menu), [menu]);

  async function uloz() {
    setStav("Ukladám…");
    const r = await fetch(`/api/admin/slides/${slide.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, variant, animation, fields }),
    });
    if (!r.ok) {
      setStav("Uloženie zlyhalo");
      return;
    }
    setUlozeny(teraz);
    setStav("Uložené — na televízoroch do 15 sekúnd");
  }

  const jeAkcia = slide.template === "akcia";
  const fa = fields as FieldsAkcia;
  const fu = fields as FieldsUvitanie;
  const uprav = (zmena: Partial<FieldsAkcia & FieldsUvitanie>) =>
    setFields((f) => ({ ...f, ...zmena }) as typeof f);

  function prepniJedlo(id: string) {
    const su = fa.dishIds;
    uprav({ dishIds: su.includes(id) ? su.filter((x) => x !== id) : [...su, id] });
  }

  return (
    <>
      <header className="hlavicka">
        <div>
          <h1>{slide.name}</h1>
          <p className="hlavicka__popis">ÚPRAVA SLIDU</p>
        </div>
        <Link className="tl tl--ticho" href="/admin/slides">
          ← Slidy
        </Link>
      </header>

      <div className="karta">
        <div className="hlava-karty">
          <h2>Náhľad</h2>
          <div className="akcie">
            <button
              className={`tl ${nahlad === "landscape" ? "tl--hlavne" : "tl--ticho"}`}
              onClick={() => setNahlad("landscape")}
            >
              Na šírku
            </button>
            <button
              className={`tl ${nahlad === "portrait" ? "tl--hlavne" : "tl--ticho"}`}
              onClick={() => setNahlad("portrait")}
            >
              Na výšku
            </button>
          </div>
        </div>
        <div className={`nahlad nahlad--${nahlad}`}>
          <SlideView
            slide={nahladSlide}
            menu={menu}
            orientation={nahlad}
            currency={menu?.currency ?? "Kč"}
          />
        </div>
        {!menu && (
          <p className="ticho">
            ChoiceQR práve neodpovedá — jedlá sa v náhľade nezobrazia, na
            televízore sa doplnia samy.
          </p>
        )}
      </div>

      <div className="karta">
        <h2>Obsah</h2>
        <label>
          Názov slidu (len pre teba)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {jeAkcia ? (
          <>
            <label>
              Nadpis
              <input value={fa.nadpis} onChange={(e) => uprav({ nadpis: e.target.value })} />
            </label>
            <label>
              Nadpis anglicky (nepovinné)
              <input value={fa.nadpisEn} onChange={(e) => uprav({ nadpisEn: e.target.value })} />
            </label>
            <label>
              Akciová cena (nepovinné — bežná sa ťahá z ChoiceQR)
              <input
                value={fa.akciovaCena}
                onChange={(e) => uprav({ akciovaCena: e.target.value })}
                placeholder="napr. 225"
              />
            </label>
            <label>
              Podtext (nepovinné)
              <input value={fa.podtext} onChange={(e) => uprav({ podtext: e.target.value })} />
            </label>
            <label>
              Podtext anglicky (nepovinné)
              <input
                value={fa.podtextEn}
                onChange={(e) => uprav({ podtextEn: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Názov podniku
              <input value={fu.nazov} onChange={(e) => uprav({ nazov: e.target.value })} />
            </label>
            <label>
              Japonská ozdoba (nepovinné)
              <input
                value={fu.kana}
                onChange={(e) => uprav({ kana: e.target.value })}
                placeholder="ラーメン"
              />
            </label>
            <label>
              Podtitul (nepovinné)
              <input value={fu.podtitul} onChange={(e) => uprav({ podtitul: e.target.value })} />
            </label>
            <label>
              Podtitul anglicky (nepovinné)
              <input
                value={fu.podtitulEn}
                onChange={(e) => uprav({ podtitulEn: e.target.value })}
              />
            </label>
            <label className="pole pole--zaskrtavacie">
              <input
                type="checkbox"
                checked={fu.zobrazitHodiny}
                onChange={(e) => uprav({ zobrazitHodiny: e.target.checked })}
                style={{ width: "auto" }}
              />
              Zobraziť otváraciu dobu (ťahá sa živo z ChoiceQR)
            </label>
          </>
        )}
      </div>

      {jeAkcia && (
        <div className="karta">
          <h2>Jedlá zo živého menu</h2>
          <p className="ticho">
            Názov a bežná cena sa ťahajú z ChoiceQR — keď ich tam zmeníš, zmenia
            sa aj tu.
          </p>
          {jedla.length === 0 && <p className="ticho">Menu sa nepodarilo načítať.</p>}
          <div className="jedla-vyber">
            {jedla.map((d) => (
              <button
                key={d.id}
                className={`jedlo-tl${fa.dishIds.includes(d.id) ? " jedlo-tl--vybrane" : ""}`}
                onClick={() => prepniJedlo(d.id)}
              >
                <span>{d.name}</span>
                <span className="ticho">{d.price} Kč</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="karta">
        <h2>Vzhľad</h2>
        <label>
          Farebný variant
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as SlideVariant)}
          >
            {VARIANTY.map((v) => (
              <option key={v.hodnota} value={v.hodnota}>
                {v.popis}
              </option>
            ))}
          </select>
        </label>
        <label>
          Animácia
          <select
            value={animation}
            onChange={(e) => setAnimation(e.target.value as SlideAnimation)}
          >
            {ANIMACIE.map((a) => (
              <option key={a.hodnota} value={a.hodnota}>
                {a.popis}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="lista">
        <span>{zmenene ? "Neuložené zmeny" : stav || "Všetko uložené"}</span>
        <button className="tl tl--hlavne" onClick={uloz} disabled={!zmenene}>
          Uložiť
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Dostýluj náhľad a výber jedál v `app/admin/admin.css`**

Na koniec súboru:

```css
/* Náhľad slidu. Pomer strán drží `aspect-ratio`, takže je to zmenšená
   televízia — nie iné rozloženie. Obsah vnútri sa škáluje sám, lebo slide
   počíta v podiele vlastného kontajnera. */
.nahlad {
  position: relative;
  width: 100%;
  border-radius: 0.6rem;
  overflow: hidden;
  border: 1px solid var(--a-linka);
  margin-top: 0.75rem;
}
.nahlad--landscape { aspect-ratio: 16 / 9; }
.nahlad--portrait { aspect-ratio: 9 / 16; max-width: 18rem; margin-inline: auto; }

.jedla-vyber {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.jedlo-tl {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  text-align: left;
  font: inherit;
  color: var(--a-ink);
  background: var(--a-papier-2);
  border: 2px solid transparent;
  border-radius: 0.5rem;
  cursor: pointer;
}
.jedlo-tl--vybrane {
  border-color: var(--a-oranz);
  background: color-mix(in srgb, var(--a-oranz) 12%, var(--a-papier-2));
}

/* Zaškrtávacie pole je jediné, kde popis patrí VEDĽA ovládania, nie nad ním. */
.pole--zaskrtavacie {
  flex-direction: row;
  align-items: center;
  gap: 0.6rem;
}
.pole--zaskrtavacie input { width: auto; min-height: 0; }
```

- [ ] **Step 4: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 5: Commit**

```bash
git add app/admin/slides app/admin/admin.css
git commit -m "Editor slidu s náhľadom pre obe orientácie"
```

---

### Task 14: Slidy v mriežke „Pridať do sledu"

**Files:**
- Modify: `app/admin/screens/[id]/page.tsx`
- Modify: `app/admin/screens/[id]/editor.tsx`

- [ ] **Step 1: V `app/admin/screens/[id]/page.tsx` načítaj slidy**

Pridaj import a načítanie, a podaj ich editoru:

```tsx
import { getSlideStore } from "@/lib/slides";
```

```tsx
  const slidyZoznam = await getSlideStore().listSlides();
```

a do `<Editor … />` pridaj `slidy={slidyZoznam}`.

- [ ] **Step 2: V `app/admin/screens/[id]/editor.tsx` prijmi slidy**

Do typu vlastností pridaj:

```tsx
  slidy: Slide[];
```

s importom:

```tsx
import type { Slide } from "@/lib/slides/types";
```

- [ ] **Step 3: Pridaj funkciu na vloženie slidu do sledu**

Vedľa `pridajMenu` / `pridajSlide` (existujúce) doplň:

```tsx
  function pridajVlastnySlide(s: Slide) {
    setItems((z) => [
      ...z,
      {
        id: novyId(),
        kind: "slide",
        mediaPath: "",
        slideId: s.id,
        durationS: 10,
        transition: "fade",
        repeats: 1,
      },
    ]);
  }
```

- [ ] **Step 4: Vlož dlaždice slidov do mriežky**

V mriežke „Pridať do sledu", hneď za dlaždicu MENU a pred ukážkové slidy,
pridaj:

```tsx
            {slidy.map((s) => (
              <button
                key={s.id}
                className="dlazdica dlazdica--slide"
                onClick={() => pridajVlastnySlide(s)}
                title={s.name}
              >
                <span className="dlazdica__stitok">SLIDE</span>
                <span className="dlazdica__nazov">{s.name}</span>
              </button>
            ))}
```

- [ ] **Step 5: Rozšír pomenovanie položky v slede**

Nájdi funkciu `nazov` a pridaj vetvu pre slide — pred hľadanie v ukážkových
slidoch:

```tsx
    i.kind === "slide"
      ? (slidy.find((s) => s.id === i.slideId)?.name ?? "Zmazaný slide")
      :
```

- [ ] **Step 6: Dostýluj dlaždicu v `app/admin/admin.css`**

```css
/* Dlaždica vlastného slidu v mriežke zdrojov. Odlíšená od ukážkových
   obrázkov, lebo slide je živý — mení sa, keď ho klient upraví. */
.dlazdica--slide {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
  background: var(--a-cierna-2);
  color: var(--a-papier);
  border-color: var(--a-oranz);
}
.dlazdica__stitok {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  color: var(--a-oranz);
}
.dlazdica__nazov { font-weight: 600; }
```

Trieda `dlazdica` aj `dlazdica__stitok` už v `admin.css` existujú z redizajnu
(vedľa `dlazdica--menu`, `--inak`, `--nahrat`). Pridávaš len `--slide`.

- [ ] **Step 7: Over preklad a testy**

Run: `npx tsc --noEmit && npm test`
Expected: bez chýb, testy zelené

- [ ] **Step 8: Commit**

```bash
git add app/admin/screens app/admin/admin.css
git commit -m "Slidy sa dajú pridať do sledu na obrazovke"
```

---

### Task 15: Celková kontrola

**Files:**
- žiadne nové

- [ ] **Step 1: Zastav dev server a postav načisto**

```bash
lsof -ti:4000 | xargs kill -9 2>/dev/null
rm -rf .next node_modules/.cache
npm test && npm run build
```

Expected: testy zelené, build bez chýb

- [ ] **Step 2: Over, že sa produkcie nikto nedotkol**

Run: `npm test -- tests/produkcia.test.ts`
Expected: PASS

- [ ] **Step 3: Spusti dev a prejdi celý tok**

```bash
nohup npx next dev -p 4000 > /tmp/dev4000.log 2>&1 &
```

Cez `ctx_execute` s `fetch` a prihlasovacou cookie over:
- `POST /api/admin/slides` s `{"name":"Akcia dne","template":"akcia"}` → 201
- `PATCH /api/admin/slides/<id>` s vyplnenými `fields` (nadpis + `dishIds`
  s jedným skutočným id z `/api/menu`) → 200
- `PATCH /api/admin/screens/<id>` s položkou `{"kind":"slide","slideId":"<id>", …}` → 200
- `GET /api/screens/<slug>` → 200 a telo obsahuje kľúč `slides` s tým slidom
- `GET /tv/<slug>` → 200

- [ ] **Step 4: Vizuálna kontrola (robí Marek)**

Nahlás, čo treba pozrieť v prehliadači:
- náhľad v editore na šírku aj na výšku
- ten istý slide na skutočnej TV adrese v oboch orientáciách
- animácie
- že sa slide s neexistujúcim jedlom preskočí

- [ ] **Step 5: Commit, ak niečo zostalo**

```bash
git status --short
```

---

## Čo po tejto etape

Nič sa **nepushuje**, kým to Marek neodsúhlasí. Potom 2. etapa: šablóny
**Oznámenie** a **Novinka** do hotového stroja.
