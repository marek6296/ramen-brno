# Obrazovky a admin — 1. etapa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klient si v adminovi vytvorí obrazovky, každej zostaví sled z menu
a ukážkových slidov, a na adrese `/tv/<slug>` to beží na TV — pričom sa zmena
v adminovi prejaví na TV sama.

**Architecture:** Všetko nové pribúda vedľa produkcie. Dáta idú cez rozhranie
`Store`, ktoré má zatiaľ len súborovú implementáciu (`.data/store.json`);
Supabase sa doplní v 2. etape výmenou jedinej implementácie. Prihlásenie je
podpísaná cookie proti údajom z premenných prostredia, bez databázy.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, vitest,
obyčajné CSS (žiadny Tailwind — projekt ho nemá).

---

## Tvrdé pravidlo pre celú etapu

**Tieto súbory sa NEDOTÝKAJÚ:** `app/page.tsx`, `app/board.tsx`,
`app/globals.css`, `app/layout.tsx`, `lib/menu.ts`, `app/api/menu/route.ts`.

Beží z nich klientovi TV v prevádzke. Ak sa zdá, že úloha si vyžaduje zásah do
niektorého z nich, je zle navrhnutá — zastav sa a povedz to, neupravuj ich.

Posledná úloha to overuje strojovo.

## Štruktúra súborov

| Súbor | Za čo zodpovedá |
|---|---|
| `lib/storage/types.ts` | tvary dát a rozhranie `Store` |
| `lib/storage/slug.ts` | prevod názvu na časť adresy |
| `lib/storage/local.ts` | implementácia `Store` nad JSON súborom |
| `lib/storage/index.ts` | vyberá implementáciu (teraz vždy lokálnu) |
| `lib/auth.ts` | overenie hesla, podpis a kontrola cookie |
| `lib/slides.ts` | zoznam ukážkových slidov |
| `app/api/admin/login/route.ts` | prihlásenie a odhlásenie |
| `app/api/admin/screens/route.ts` | zoznam a vytvorenie obrazovky |
| `app/api/admin/screens/[id]/route.ts` | úprava a zmazanie obrazovky |
| `app/api/screens/[slug]/route.ts` | nastavenia obrazovky pre TV (verejné) |
| `app/admin/layout.tsx` | obal adminu + vlastné CSS |
| `app/admin/admin.css` | vzhľad adminu (ruší celoobrazovkový režim) |
| `app/admin/page.tsx` | zoznam obrazoviek |
| `app/admin/login/page.tsx` | prihlasovací formulár |
| `app/admin/screens/[id]/page.tsx` | detail obrazovky a editor sledu |
| `app/tv/[slug]/page.tsx` | načíta obrazovku zo `Store` |
| `app/tv/[slug]/player.tsx` | strieda položky, fullscreen, dopyt na zmeny |
| `app/tv/[slug]/player.css` | vzhľad prehrávača |
| `public/demo/*.svg` | ukážkové slidy |

---

### Task 1: Testovacie prostredie

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Nainštaluj vitest**

```bash
cd "/Users/marek/tv info/tv-menu" && npm install -D vitest
```

- [ ] **Step 2: Vytvor `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 3: Pridaj skript do `package.json`**

Do sekcie `"scripts"` pridaj riadok:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Napíš overovací test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("testovacie prostredie", () => {
  it("beží", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Spusti testy**

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 6: Dopln `.gitignore`**

Na koniec `.gitignore` pridaj:

```
.data
.env*.local
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests .gitignore
git commit -m "Testovacie prostredie (vitest)"
```

---

### Task 2: Tvary dát a prevod na slug

**Files:**
- Create: `lib/storage/types.ts`
- Create: `lib/storage/slug.ts`
- Test: `tests/slug.test.ts`

- [ ] **Step 1: Napíš padajúci test**

`tests/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeSlug } from "@/lib/storage/slug";

describe("normalizeSlug", () => {
  it("zhodí diakritiku a medzery", () => {
    expect(normalizeSlug("TV pri báre")).toBe("tv-pri-bare");
  });

  it("zhodí zvláštne znaky", () => {
    expect(normalizeSlug("Menu #1 / hlavná!")).toBe("menu-1-hlavna");
  });

  it("neostanú pomlčky na krajoch", () => {
    expect(normalizeSlug("  --menu--  ")).toBe("menu");
  });

  it("prázdny vstup dá prázdny výstup", () => {
    expect(normalizeSlug("???")).toBe("");
  });

  it("obmedzí dĺžku na 40 znakov", () => {
    expect(normalizeSlug("a".repeat(60))).toHaveLength(40);
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/storage/slug'`

- [ ] **Step 3: Napíš `lib/storage/slug.ts`**

```ts
/**
 * Názov obrazovky od klienta -> bezpečná časť adresy.
 * Diakritika ide preč, lebo `/tv/tv-pri-báre` sa zle prepisuje na TV
 * aj zle posiela v správe.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
```

- [ ] **Step 4: Spusti testy**

Run: `npm test`
Expected: PASS, 6 testov

- [ ] **Step 5: Napíš `lib/storage/types.ts`**

```ts
export type Orientation = "landscape" | "portrait";

/** `video` sa spracováva až v 2. etape, typ je tu, aby sa model nemusel meniť */
export type ItemKind = "menu" | "image" | "video";

export type PlaylistItem = {
  id: string;
  kind: ItemKind;
  /** cesta k súboru; pri `menu` prázdny reťazec */
  mediaPath: string;
  /** ako dlho je položka vidieť, v sekundách */
  durationS: number;
};

export type Screen = {
  id: string;
  slug: string;
  name: string;
  orientation: Orientation;
  items: PlaylistItem[];
  /** milisekundy; podľa nej TV pozná, že sa niečo zmenilo */
  updatedAt: number;
};

export type NewScreen = {
  name: string;
  slug: string;
  orientation: Orientation;
};

export type ScreenPatch = Partial<{
  name: string;
  slug: string;
  orientation: Orientation;
  items: PlaylistItem[];
}>;

/**
 * Jediné miesto, cez ktoré sa siaha na dáta. V 2. etape pribudne
 * implementácia nad Supabase; nič iné sa kvôli tomu meniť nebude.
 */
export interface Store {
  listScreens(): Promise<Screen[]>;
  getScreen(id: string): Promise<Screen | null>;
  getScreenBySlug(slug: string): Promise<Screen | null>;
  createScreen(input: NewScreen): Promise<Screen>;
  updateScreen(id: string, patch: ScreenPatch): Promise<Screen>;
  deleteScreen(id: string): Promise<void>;
}
```

- [ ] **Step 6: Over, že to prejde prekladačom**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 7: Commit**

```bash
git add lib/storage tests/slug.test.ts
git commit -m "Tvary dát pre obrazovky a prevod názvu na slug"
```

---

### Task 3: Lokálne úložisko nad JSON súborom

**Files:**
- Create: `lib/storage/local.ts`
- Create: `lib/storage/index.ts`
- Test: `tests/local-store.test.ts`

- [ ] **Step 1: Napíš padajúce testy**

`tests/local-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLocalStore } from "@/lib/storage/local";
import type { Store } from "@/lib/storage/types";

let dir: string;
let store: Store;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tvstore-"));
  store = createLocalStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("lokálne úložisko", () => {
  it("na prázdnom úložisku vráti prázdny zoznam", async () => {
    expect(await store.listScreens()).toEqual([]);
  });

  it("vytvorí obrazovku a nájde ju podľa slugu", async () => {
    const s = await store.createScreen({
      name: "Hlavná",
      slug: "hlavna",
      orientation: "landscape",
    });
    expect(s.id).toBeTruthy();
    expect(s.items).toEqual([]);
    expect(await store.getScreenBySlug("hlavna")).toEqual(s);
  });

  it("nedovolí dva rovnaké slugy", async () => {
    await store.createScreen({ name: "A", slug: "tv", orientation: "landscape" });
    await expect(
      store.createScreen({ name: "B", slug: "tv", orientation: "portrait" }),
    ).rejects.toThrow(/slug/i);
  });

  it("úprava posunie updatedAt", async () => {
    const s = await store.createScreen({
      name: "A",
      slug: "a",
      orientation: "landscape",
    });
    const po = await store.updateScreen(s.id, { orientation: "portrait" });
    expect(po.orientation).toBe("portrait");
    expect(po.updatedAt).toBeGreaterThan(s.updatedAt);
  });

  it("zmazanie obrazovku odstráni", async () => {
    const s = await store.createScreen({
      name: "A",
      slug: "a",
      orientation: "landscape",
    });
    await store.deleteScreen(s.id);
    expect(await store.getScreen(s.id)).toBeNull();
  });

  it("dáta prežijú nový store nad tým istým priečinkom", async () => {
    await store.createScreen({ name: "A", slug: "a", orientation: "landscape" });
    const druhy = createLocalStore(dir);
    expect(await druhy.listScreens()).toHaveLength(1);
  });

  it("úprava neexistujúcej obrazovky padne", async () => {
    await expect(store.updateScreen("nieje", { name: "X" })).rejects.toThrow(
      /nenájden/i,
    );
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/storage/local'`

- [ ] **Step 3: Napíš `lib/storage/local.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { NewScreen, Screen, ScreenPatch, Store } from "./types";

type Data = { screens: Screen[] };

/**
 * Úložisko nad jedným JSON súborom. Slúži na vývoj a na skúšanie, kým klient
 * nemá Supabase. Zápis ide cez dočasný súbor a premenovanie, aby súbor
 * neostal poloprepísaný, keby sa proces vypol uprostred.
 */
export function createLocalStore(dir: string): Store {
  const file = path.join(dir, "store.json");

  async function read(): Promise<Data> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Data;
    } catch {
      return { screens: [] };
    }
  }

  async function write(data: Data): Promise<void> {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, file);
  }

  return {
    async listScreens() {
      const { screens } = await read();
      return [...screens].sort((a, b) => a.name.localeCompare(b.name, "sk"));
    },

    async getScreen(id) {
      const { screens } = await read();
      return screens.find((s) => s.id === id) ?? null;
    },

    async getScreenBySlug(slug) {
      const { screens } = await read();
      return screens.find((s) => s.slug === slug) ?? null;
    },

    async createScreen(input: NewScreen) {
      const data = await read();
      if (data.screens.some((s) => s.slug === input.slug)) {
        throw new Error(`Obrazovka so slugom „${input.slug}" už existuje`);
      }
      const screen: Screen = {
        id: randomUUID(),
        name: input.name,
        slug: input.slug,
        orientation: input.orientation,
        items: [],
        updatedAt: Date.now(),
      };
      data.screens.push(screen);
      await write(data);
      return screen;
    },

    async updateScreen(id, patch: ScreenPatch) {
      const data = await read();
      const i = data.screens.findIndex((s) => s.id === id);
      if (i === -1) throw new Error("Obrazovka nenájdená");
      if (
        patch.slug &&
        data.screens.some((s) => s.slug === patch.slug && s.id !== id)
      ) {
        throw new Error(`Obrazovka so slugom „${patch.slug}" už existuje`);
      }
      const updated: Screen = {
        ...data.screens[i],
        ...patch,
        // musí vždy narásť, inak by TV nespoznala zmenu v rámci tej istej ms
        updatedAt: Math.max(Date.now(), data.screens[i].updatedAt + 1),
      };
      data.screens[i] = updated;
      await write(data);
      return updated;
    },

    async deleteScreen(id) {
      const data = await read();
      data.screens = data.screens.filter((s) => s.id !== id);
      await write(data);
    },
  };
}
```

- [ ] **Step 4: Spusti testy**

Run: `npm test`
Expected: PASS, všetkých 7 testov úložiska

- [ ] **Step 5: Napíš `lib/storage/index.ts`**

```ts
import path from "node:path";
import { createLocalStore } from "./local";
import type { Store } from "./types";

let instance: Store | null = null;

/**
 * Jediné miesto, kde sa rozhoduje, kam sa dáta ukladajú. V 2. etape tu
 * pribudne vetva na Supabase; volajúci kód o tom nebude vedieť.
 */
export function getStore(): Store {
  if (!instance) {
    instance = createLocalStore(
      process.env.TV_DATA_DIR ?? path.join(process.cwd(), ".data"),
    );
  }
  return instance;
}
```

- [ ] **Step 6: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 7: Commit**

```bash
git add lib/storage tests/local-store.test.ts
git commit -m "Lokálne úložisko obrazoviek nad JSON súborom"
```

---

### Task 4: Prihlásenie — overenie hesla a podpis cookie

**Files:**
- Create: `lib/auth.ts`
- Test: `tests/auth.test.ts`
- Create: `.env.local`

- [ ] **Step 1: Napíš padajúce testy**

`tests/auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkCredentials, signToken, verifyToken } from "@/lib/auth";

beforeEach(() => {
  process.env.ADMIN_USER = "admin";
  process.env.ADMIN_PASSWORD = "tajne-heslo";
  process.env.ADMIN_SECRET = "podpisovy-kluc";
});

describe("checkCredentials", () => {
  it("pustí správne údaje", () => {
    expect(checkCredentials("admin", "tajne-heslo")).toBe(true);
  });

  it("odmietne zlé heslo", () => {
    expect(checkCredentials("admin", "zle")).toBe(false);
  });

  it("odmietne zlé meno", () => {
    expect(checkCredentials("niekto", "tajne-heslo")).toBe(false);
  });

  it("odmietne, keď heslo nie je nastavené v prostredí", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkCredentials("admin", "")).toBe(false);
  });
});

describe("token", () => {
  it("vlastný podpis prejde", () => {
    expect(verifyToken(signToken(Date.now() + 60_000))).toBe(true);
  });

  it("vypršaný token neprejde", () => {
    expect(verifyToken(signToken(Date.now() - 1))).toBe(false);
  });

  it("prepísaný token neprejde", () => {
    const t = signToken(Date.now() + 60_000);
    expect(verifyToken(t.replace(/.$/, "x"))).toBe(false);
  });

  it("nezmysel neprejde", () => {
    expect(verifyToken("cokolvek")).toBe(false);
    expect(verifyToken("")).toBe(false);
  });

  it("token podpísaný iným kľúčom neprejde", () => {
    const t = signToken(Date.now() + 60_000);
    process.env.ADMIN_SECRET = "iny-kluc";
    expect(verifyToken(t)).toBe(false);
  });
});
```

- [ ] **Step 2: Spusti a over, že padá**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Napíš `lib/auth.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tv_admin";
/** ako dlho platí prihlásenie */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function rovnake(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual padá na rôznych dĺžkach, preto ich najprv porovnáme
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Údaje sú v premenných prostredia, nie v databáze — admin tým pádom funguje
 * aj predtým, než k nemu pripojíme Supabase.
 */
export function checkCredentials(user: string, password: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  return rovnake(user, u) && rovnake(password, p);
}

function podpis(payload: string): string {
  const secret = process.env.ADMIN_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** token = do kedy platí + podpis, aby sa nedal prepísať */
export function signToken(expiresAtMs: number): string {
  const payload = String(Math.floor(expiresAtMs));
  return `${payload}.${podpis(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!rovnake(sig, podpis(payload))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}
```

- [ ] **Step 4: Spusti testy**

Run: `npm test`
Expected: PASS, všetkých 9 testov prihlásenia

- [ ] **Step 5: Vytvor `.env.local`**

Hodnoty si vygeneruj, NEOPISUJ ich odtiaľto — čokoľvek, čo je napísané
v pláne, je v gite a prestáva byť tajomstvom:

```bash
printf 'ADMIN_USER=admin\nADMIN_PASSWORD=%s\nADMIN_SECRET=%s\n' \
  "$(openssl rand -base64 15 | tr -d '/+=')" \
  "$(openssl rand -base64 48 | tr -d '/+=')" > .env.local
```

`ADMIN_SECRET` musí mať aspoň 24 znakov — kratšie `lib/auth.ts` odmietne.

- [ ] **Step 6: Over, že `.env.local` nejde do gitu**

Run: `git status --short`
Expected: `.env.local` sa v zozname **neobjaví**

- [ ] **Step 7: Commit**

```bash
git add lib/auth.ts tests/auth.test.ts
git commit -m "Prihlásenie do adminu cez premenné prostredia"
```

---

### Task 5: Prihlasovacia routa a formulár

**Files:**
- Create: `app/api/admin/login/route.ts`
- Create: `app/admin/login/page.tsx`
- Create: `lib/session.ts`

- [ ] **Step 1: Napíš `lib/session.ts`**

```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyToken } from "./auth";

/** true, keď má návštevník platnú prihlasovaciu cookie */
export async function isLoggedIn(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}
```

- [ ] **Step 2: Napíš `app/api/admin/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MS, checkCredentials, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, password } = (await req.json().catch(() => ({}))) as {
    user?: string;
    password?: string;
  };

  if (!checkCredentials(user ?? "", password ?? "")) {
    return NextResponse.json({ error: "Nesprávne meno alebo heslo" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signToken(Date.now() + SESSION_MS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 3: Napíš `app/admin/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [chyba, setChyba] = useState("");
  const [caka, setCaka] = useState(false);

  async function odosli(e: React.FormEvent) {
    e.preventDefault();
    setCaka(true);
    setChyba("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    setCaka(false);
    if (!r.ok) {
      setChyba("Nesprávne meno alebo heslo");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form className="karta karta--uzka" onSubmit={odosli}>
      <h1>Prihlásenie</h1>
      <label>
        Meno
        <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
      </label>
      <label>
        Heslo
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {chyba && <p className="chyba">{chyba}</p>}
      <button disabled={caka}>{caka ? "Overujem…" : "Prihlásiť"}</button>
    </form>
  );
}
```

- [ ] **Step 4: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts app/api/admin/login app/admin/login
git commit -m "Prihlasovacia routa a formulár"
```

---

### Task 6: Obal adminu a jeho vzhľad

Produkčné `globals.css` dáva `html, body { height: 100%; overflow: hidden }`,
lebo menu na TV sa nemá rolovať. V adminovi to prekáža. Riešime to **bez zásahu
do `globals.css`** — pravidlom v admin CSS, ktoré cieli na `body`, keď obsahuje
admin obal.

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/admin.css`

- [ ] **Step 1: Napíš `app/admin/admin.css`**

```css
/* Produkčné globals.css zamyká stránku na celú obrazovku bez rolovania —
   pre TV správne, pre admin nie. Odomykáme to len tam, kde je admin obal,
   aby sa produkčný súbor nemusel meniť. */
body:has(.admin) {
  height: auto;
  overflow: auto;
  background: #f4f2ec;
}

.admin {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 6rem;
  font-size: 16px;
  line-height: 1.5;
  color: #14110f;
}

.admin a { color: #a8500c; }

.admin__hlavicka {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(20, 17, 15, 0.15);
  padding-bottom: 0.75rem;
}

.admin__hlavicka h1 { font-size: 1.5rem; letter-spacing: 0.02em; }

.karta {
  background: #fff;
  border: 1px solid rgba(20, 17, 15, 0.12);
  border-radius: 0.5rem;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.karta--uzka { max-width: 24rem; margin: 4rem auto; }

.karta h1, .karta h2 { margin-bottom: 1rem; font-size: 1.15rem; }

.admin label {
  display: block;
  margin-bottom: 0.9rem;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b6459;
}

.admin input,
.admin select {
  display: block;
  width: 100%;
  margin-top: 0.3rem;
  padding: 0.6rem 0.7rem;
  font: inherit;
  color: #14110f;
  background: #fff;
  border: 1px solid rgba(20, 17, 15, 0.25);
  border-radius: 0.35rem;
}

.admin button {
  font: inherit;
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: 0.35rem;
  background: #14110f;
  color: #f4f2ec;
  cursor: pointer;
}

.admin button[disabled] { opacity: 0.5; cursor: default; }
.admin button.vedlajsie { background: transparent; color: #14110f; border: 1px solid rgba(20, 17, 15, 0.3); }
.admin button.zle { background: #b23b18; }

.riadok { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.riadok--medzi { justify-content: space-between; }

.chyba { color: #b23b18; margin-bottom: 0.75rem; }
.ticho { color: #6b6459; font-size: 0.9rem; }

.odkaz-tv {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  background: #f4f2ec;
  padding: 0.35rem 0.5rem;
  border-radius: 0.25rem;
  word-break: break-all;
}
```

- [ ] **Step 2: Napíš `app/admin/layout.tsx`**

```tsx
import "./admin.css";

export const metadata = { title: "Správa obrazoviek" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
```

- [ ] **Step 3: Spusti dev server a pozri prihlásenie**

```bash
lsof -ti:4000 | xargs kill -9 2>/dev/null; npm run dev
```

Otvor `http://localhost:4000/admin/login`.
Expected: formulár na svetlom pozadí, stránka sa dá rolovať, nie je čierna.

- [ ] **Step 4: Over, že produkcia beží ďalej**

Otvor `http://localhost:4000/`.
Expected: menu vyzerá presne ako predtým, na celú obrazovku, bez rolovania.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/admin.css
git commit -m "Obal adminu a jeho vzhľad, bez zásahu do produkčného CSS"
```

---

### Task 7: API adminu pre obrazovky

**Files:**
- Create: `app/api/admin/screens/route.ts`
- Create: `app/api/admin/screens/[id]/route.ts`

- [ ] **Step 1: Napíš `app/api/admin/screens/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { normalizeSlug } from "@/lib/storage/slug";
import { isLoggedIn } from "@/lib/session";
import type { Orientation } from "@/lib/storage/types";

export async function GET() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  return NextResponse.json(await getStore().listScreens());
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    orientation?: Orientation;
  };

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Názov nesmie byť prázdny" }, { status: 400 });
  }

  const slug = normalizeSlug(name);
  if (!slug) {
    return NextResponse.json(
      { error: "Z názvu sa nedá urobiť adresa — použi písmená alebo číslice" },
      { status: 400 },
    );
  }

  const orientation: Orientation =
    body.orientation === "portrait" ? "portrait" : "landscape";

  try {
    return NextResponse.json(
      await getStore().createScreen({ name, slug, orientation }),
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 409 },
    );
  }
}
```

- [ ] **Step 2: Napíš `app/api/admin/screens/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import type { PlaylistItem, ScreenPatch } from "@/lib/storage/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as ScreenPatch;
  const patch: ScreenPatch = {};

  // Slug sa pri premenovaní ZÁMERNE nemení. TV je fyzicky nastavená na
  // konkrétnu adresu; keby sa zmenila s názvom, obrazovka by zhasla a nikto
  // by netušil prečo. Adresa vzniká raz, pri založení obrazovky.
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }

  if (body.orientation === "portrait" || body.orientation === "landscape") {
    patch.orientation = body.orientation;
  }

  if (Array.isArray(body.items)) {
    patch.items = body.items.map(
      (it: PlaylistItem): PlaylistItem => ({
        id: String(it.id),
        kind: it.kind === "image" || it.kind === "video" ? it.kind : "menu",
        mediaPath: String(it.mediaPath ?? ""),
        // pod 3 s by nikto nestihol prečítať, nad hodinu nemá zmysel
        durationS: Math.min(3600, Math.max(3, Math.round(Number(it.durationS) || 10))),
      }),
    );
  }

  try {
    return NextResponse.json(await getStore().updateScreen(id, patch));
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return NextResponse.json({ error: msg }, { status: /nenájden/i.test(msg) ? 404 : 409 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  await getStore().deleteScreen(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 4: Over, že API bez prihlásenia nepustí**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/admin/screens
```

Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/screens
git commit -m "API adminu na správu obrazoviek"
```

---

### Task 8: Zoznam obrazoviek v adminovi

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/screens-list.tsx`

- [ ] **Step 1: Napíš `app/admin/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import ScreensList from "./screens-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");
  return <ScreensList initial={await getStore().listScreens()} />;
}
```

- [ ] **Step 2: Napíš `app/admin/screens-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Orientation, Screen } from "@/lib/storage/types";

export default function ScreensList({ initial }: { initial: Screen[] }) {
  const router = useRouter();
  const [screens, setScreens] = useState(initial);
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [chyba, setChyba] = useState("");

  async function pridaj(e: React.FormEvent) {
    e.preventDefault();
    setChyba("");
    const r = await fetch("/api/admin/screens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, orientation }),
    });
    const data = await r.json();
    if (!r.ok) {
      setChyba(data.error ?? "Nepodarilo sa");
      return;
    }
    setScreens((s) => [...s, data as Screen]);
    setName("");
  }

  async function zmaz(s: Screen) {
    if (!confirm(`Naozaj zmazať „${s.name}"? Sled položiek sa stratí.`)) return;
    await fetch(`/api/admin/screens/${s.id}`, { method: "DELETE" });
    setScreens((zoznam) => zoznam.filter((x) => x.id !== s.id));
  }

  async function odhlas() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className="admin__hlavicka">
        <h1>Obrazovky</h1>
        <button className="vedlajsie" onClick={odhlas}>
          Odhlásiť
        </button>
      </header>

      {screens.length === 0 && (
        <p className="ticho">Zatiaľ žiadna obrazovka. Pridaj prvú nižšie.</p>
      )}

      {screens.map((s) => (
        <div className="karta" key={s.id}>
          <div className="riadok riadok--medzi">
            <div>
              <strong>{s.name}</strong>{" "}
              <span className="ticho">
                {s.orientation === "portrait" ? "na výšku" : "na šírku"} ·{" "}
                {s.items.length} položiek v slede
              </span>
            </div>
            <div className="riadok">
              <Link href={`/admin/screens/${s.id}`}>Nastaviť</Link>
              <button className="zle" onClick={() => zmaz(s)}>
                Zmazať
              </button>
            </div>
          </div>
          <p className="riadok">
            <span className="odkaz-tv">/tv/{s.slug}</span>
            <button
              className="vedlajsie"
              onClick={() =>
                navigator.clipboard?.writeText(`${location.origin}/tv/${s.slug}`)
              }
            >
              Kopírovať odkaz
            </button>
          </p>
        </div>
      ))}

      <form className="karta" onSubmit={pridaj}>
        <h2>Pridať obrazovku</h2>
        <label>
          Názov
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="napr. TV pri bare"
          />
        </label>
        <label>
          Orientácia
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
          >
            <option value="landscape">na šírku</option>
            <option value="portrait">na výšku</option>
          </select>
        </label>
        {chyba && <p className="chyba">{chyba}</p>}
        <button disabled={!name.trim()}>Pridať</button>
      </form>
    </>
  );
}
```

- [ ] **Step 3: Vyskúšaj v prehliadači**

Prihlás sa na `http://localhost:4000/admin/login` údajmi z `.env.local`,
potom pridaj obrazovku „Hlavná" na šírku.
Expected: obrazovka pribudne v zozname a pod ňou je `/tv/hlavna`.

- [ ] **Step 4: Over, že sa dáta uložili**

```bash
cat "/Users/marek/tv info/tv-menu/.data/store.json"
```

Expected: JSON s jednou obrazovkou, `"slug": "hlavna"`

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/admin/screens-list.tsx
git commit -m "Zoznam obrazoviek v adminovi"
```

---

### Task 9: Ukážkové slidy

Slidy sú SVG, aby boli malé, ostré na 4K a nepotrebovali úložisko. Rozmer
1920×1080 aj 1080×1920, nech sedia na obe orientácie.

**Files:**
- Create: `public/demo/akce-dne.svg`
- Create: `public/demo/otvaracie-hodiny.svg`
- Create: `public/demo/na-vysku-uvitanie.svg`
- Create: `lib/slides.ts`

- [ ] **Step 1: Vytvor `public/demo/akce-dne.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <rect width="1920" height="1080" fill="#f4f2ec"/>
  <rect x="60" y="60" width="1800" height="960" fill="none" stroke="#a8500c" stroke-width="4"/>
  <text x="960" y="420" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="150" font-weight="900" fill="#14110f" letter-spacing="8">AKCE DNE</text>
  <text x="960" y="560" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="64" fill="#6b6459" letter-spacing="14">DEAL OF THE DAY</text>
  <text x="960" y="760" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="90" font-weight="700" fill="#a8500c">Ramen + nápoj za 295 Kč</text>
</svg>
```

- [ ] **Step 2: Vytvor `public/demo/otvaracie-hodiny.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <rect width="1920" height="1080" fill="#14110f"/>
  <text x="960" y="430" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="120" font-weight="900" fill="#f4f2ec" letter-spacing="10">OTEVÍRACÍ DOBA</text>
  <text x="960" y="620" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="140" font-weight="700" fill="#d9741a">11:00 — 20:00</text>
  <text x="960" y="760" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="56" fill="#6b6459" letter-spacing="16">PO — NE</text>
</svg>
```

- [ ] **Step 3: Vytvor `public/demo/na-vysku-uvitanie.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <rect width="1080" height="1920" fill="#f4f2ec"/>
  <rect x="50" y="50" width="980" height="1820" fill="none" stroke="#a8500c" stroke-width="4"/>
  <text x="540" y="760" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="120" font-weight="900" fill="#14110f" letter-spacing="6">RAMEN</text>
  <text x="540" y="900" text-anchor="middle" font-family="'Noto Sans JP', sans-serif"
        font-size="90" fill="#a8500c">ラーメン</text>
  <text x="540" y="1120" text-anchor="middle" font-family="Roboto, Arial, sans-serif"
        font-size="54" fill="#6b6459" letter-spacing="12">VÁCLAVSKÁ · BRNO</text>
</svg>
```

- [ ] **Step 4: Napíš `lib/slides.ts`**

```ts
export type DemoSlide = {
  path: string;
  label: string;
  /** pre ktorú orientáciu je slide navrhnutý */
  orientation: "landscape" | "portrait";
};

/**
 * Ukážkové slidy sú súčasťou projektu, nie úložiska. Vďaka tomu sa dá celé
 * striedanie odskúšať na TV ešte predtým, než klient dodá Supabase.
 * V 2. etape k nim pribudne nahrávanie vlastných; tieto zostanú.
 */
export const DEMO_SLIDES: DemoSlide[] = [
  { path: "/demo/akce-dne.svg", label: "Akce dne", orientation: "landscape" },
  { path: "/demo/otvaracie-hodiny.svg", label: "Otevírací doba", orientation: "landscape" },
  { path: "/demo/na-vysku-uvitanie.svg", label: "Uvítanie (na výšku)", orientation: "portrait" },
];
```

- [ ] **Step 5: Over, že sa slidy servírujú**

Otvor `http://localhost:4000/demo/akce-dne.svg`.
Expected: svetlý slide s nápisom AKCE DNE.

- [ ] **Step 6: Commit**

```bash
git add public/demo lib/slides.ts
git commit -m "Ukážkové slidy na skúšanie bez úložiska"
```

---

### Task 10: Editor sledu

**Files:**
- Create: `app/admin/screens/[id]/page.tsx`
- Create: `app/admin/screens/[id]/editor.tsx`

- [ ] **Step 1: Napíš `app/admin/screens/[id]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import { DEMO_SLIDES } from "@/lib/slides";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const { id } = await params;
  const screen = await getStore().getScreen(id);
  if (!screen) notFound();
  return <Editor screen={screen} slides={DEMO_SLIDES} />;
}
```

- [ ] **Step 2: Napíš `app/admin/screens/[id]/editor.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { DemoSlide } from "@/lib/slides";
import type { Orientation, PlaylistItem, Screen } from "@/lib/storage/types";

export default function Editor({
  screen,
  slides,
}: {
  screen: Screen;
  slides: DemoSlide[];
}) {
  const [name, setName] = useState(screen.name);
  const [orientation, setOrientation] = useState<Orientation>(screen.orientation);
  const [items, setItems] = useState<PlaylistItem[]>(screen.items);
  const [slug, setSlug] = useState(screen.slug);
  const [stav, setStav] = useState("");

  function novyId() {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }

  function pridajMenu() {
    setItems((z) => [
      ...z,
      { id: novyId(), kind: "menu", mediaPath: "", durationS: 30 },
    ]);
  }

  function pridajSlide(path: string) {
    setItems((z) => [
      ...z,
      { id: novyId(), kind: "image", mediaPath: path, durationS: 10 },
    ]);
  }

  function odober(id: string) {
    setItems((z) => z.filter((i) => i.id !== id));
  }

  function posun(i: number, o: number) {
    setItems((z) => {
      const ciel = i + o;
      if (ciel < 0 || ciel >= z.length) return z;
      const kopia = [...z];
      [kopia[i], kopia[ciel]] = [kopia[ciel], kopia[i]];
      return kopia;
    });
  }

  function trvanie(id: string, s: number) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, durationS: s } : i)));
  }

  async function uloz() {
    setStav("Ukladám…");
    const r = await fetch(`/api/admin/screens/${screen.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, orientation, items }),
    });
    const data = await r.json();
    if (!r.ok) {
      setStav(data.error ?? "Nepodarilo sa uložiť");
      return;
    }
    setSlug((data as Screen).slug); // adresa sa nemení, len si držíme pravdu zo servera
    setStav("Uložené — TV sa prispôsobí do 15 sekúnd");
  }

  const nazov = (i: PlaylistItem) =>
    i.kind === "menu"
      ? "Menu (živé z ChoiceQR)"
      : (slides.find((s) => s.path === i.mediaPath)?.label ?? i.mediaPath);

  return (
    <>
      <header className="admin__hlavicka">
        <h1>{screen.name}</h1>
        <Link href="/admin">← Späť na zoznam</Link>
      </header>

      <div className="karta">
        <h2>Nastavenia</h2>
        <label>
          Názov
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Orientácia
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
          >
            <option value="landscape">na šírku</option>
            <option value="portrait">na výšku</option>
          </select>
        </label>
        <p className="ticho">
          Adresa pre TV (premenovaním sa nezmení, aby nastavená TV nezhasla):
        </p>
        <p className="odkaz-tv">/tv/{slug}</p>
      </div>

      <div className="karta">
        <h2>Sled na obrazovke</h2>
        {items.length === 0 && (
          <p className="ticho">Sled je prázdny — obrazovka zatiaľ nič neukáže.</p>
        )}
        {items.map((i, index) => (
          <div className="riadok riadok--medzi" key={i.id} style={{ marginBottom: "0.6rem" }}>
            <span>
              {index + 1}. {nazov(i)}
            </span>
            <span className="riadok">
              <input
                type="number"
                min={3}
                max={3600}
                value={i.durationS}
                onChange={(e) => trvanie(i.id, Number(e.target.value))}
                style={{ width: "5.5rem" }}
              />
              <span className="ticho">s</span>
              <button className="vedlajsie" onClick={() => posun(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button
                className="vedlajsie"
                onClick={() => posun(index, 1)}
                disabled={index === items.length - 1}
              >
                ↓
              </button>
              <button className="zle" onClick={() => odober(i.id)}>
                ×
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="karta">
        <h2>Pridať do sledu</h2>
        <div className="riadok">
          <button className="vedlajsie" onClick={pridajMenu}>
            + Menu
          </button>
          {slides.map((s) => (
            <button key={s.path} className="vedlajsie" onClick={() => pridajSlide(s.path)}>
              + {s.label}
            </button>
          ))}
        </div>
        <p className="ticho" style={{ marginTop: "0.8rem" }}>
          Nahrávanie vlastných obrázkov pribudne po pripojení databázy.
        </p>
      </div>

      <div className="riadok">
        <button onClick={uloz}>Uložiť</button>
        {stav && <span className="ticho">{stav}</span>}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Vyskúšaj v prehliadači**

V adminovi otvor obrazovku „Hlavná", pridaj `+ Menu` a `+ Akce dne`,
nastav trvanie 15 a 8 sekúnd, ulož.
Expected: hláška „Uložené — TV sa prispôsobí do 15 sekúnd"

- [ ] **Step 4: Over uložené dáta**

```bash
cat "/Users/marek/tv info/tv-menu/.data/store.json"
```

Expected: pole `items` s dvoma položkami, `kind` `menu` a `image`

- [ ] **Step 5: Commit**

```bash
git add app/admin/screens
git commit -m "Editor sledu položiek pre obrazovku"
```

---

### Task 11: Verejné API pre TV

**Files:**
- Create: `app/api/screens/[slug]/route.ts`

- [ ] **Step 1: Napíš routu**

```ts
import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Nastavenia obrazovky pre TV. Verejné a len na čítanie — TV sa neprihlasuje.
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
  return NextResponse.json(screen, {
    headers: { "cache-control": "no-store" },
  });
}
```

- [ ] **Step 2: Over, že routa odpovedá**

```bash
curl -s http://localhost:4000/api/screens/hlavna | head -c 300
```

Expected: JSON s `"slug":"hlavna"` a poľom `items`

- [ ] **Step 3: Over, že neexistujúca obrazovka dá 404**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/screens/nieje
```

Expected: `404`

- [ ] **Step 4: Commit**

```bash
git add app/api/screens
git commit -m "Verejné API s nastaveniami obrazovky pre TV"
```

---

### Task 12: Prehrávač na `/tv/<slug>`

Kľúčová podmienka z návrhu: **médiá sa nesmú načítavať znova pri každom kole.**
Preto sú všetky obrázky v DOM od začiatku a prepína sa len priehľadnosť.
Nepoužívame `display: none`, lebo menu si po zobrazení meria vlastné rozmery
a v skrytom prvku by namerala nulu.

**Files:**
- Create: `app/tv/[slug]/page.tsx`
- Create: `app/tv/[slug]/player.tsx`
- Create: `app/tv/[slug]/player.css`

- [ ] **Step 1: Napíš `app/tv/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getStore } from "@/lib/storage";
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
  return <Player initial={screen} />;
}
```

- [ ] **Step 2: Napíš `app/tv/[slug]/player.css`**

```css
.prehravac {
  position: fixed;
  inset: 0;
  background: #f4f2ec;
  overflow: hidden;
}

/* Každá položka leží cez celú plochu a prepína sa len priehľadnosťou.
   Zostáva v DOM, takže sa obrázok stiahne raz a menu si vie odmerať rozmery. */
.polozka {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 600ms ease;
}

.polozka--vidno {
  opacity: 1;
  pointer-events: auto;
}

.polozka img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.prazdne {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b6459;
  font-size: 2vh;
  letter-spacing: 0.1em;
  text-align: center;
  padding: 4vh;
}

.celu-obrazovku {
  position: fixed;
  bottom: 2.4vh;
  right: 2.4vh;
  z-index: 20;
  padding: 1.1vh 1.6vh;
  font-family: Roboto, sans-serif;
  font-size: 1.35vh;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f4f2ec;
  background: #14110f;
  border: none;
  border-radius: 0.6vh;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 200ms;
}

.celu-obrazovku:hover { opacity: 1; }
.prehravac--bez-kurzora { cursor: none; }
.prehravac--bez-kurzora .celu-obrazovku { opacity: 0; }
```

- [ ] **Step 3: Napíš `app/tv/[slug]/player.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/app/board";
import type { MenuData } from "@/lib/menu";
import type { Screen } from "@/lib/storage/types";
import "./player.css";

/** ako často sa TV pýta, či klient niečo nezmenil */
const DOPYT_MS = 15_000;
/** ako často sa obnovuje menu — rovnako ako na produkčnej TV */
const MENU_MS = 60_000;

export default function Player({ initial }: { initial: Screen }) {
  const [screen, setScreen] = useState(initial);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [index, setIndex] = useState(0);
  const [bezKurzora, setBezKurzora] = useState(false);
  const casovac = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = screen.items;
  const maMenu = items.some((i) => i.kind === "menu");

  /* Nastavenia: pýtame sa pravidelne, nech sa zmena z adminu prejaví sama
     a nikto nemusí ísť k TV reštartovať prehliadač. */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/screens/${screen.slug}`, { cache: "no-store" });
        if (!r.ok) return;
        const fresh = (await r.json()) as Screen;
        setScreen((stary) => (fresh.updatedAt !== stary.updatedAt ? fresh : stary));
      } catch {
        /* výpadok siete nesmie zhodiť obrazovku — skúsime o 15 s znova */
      }
    }, DOPYT_MS);
    return () => clearInterval(id);
  }, [screen.slug]);

  /* Menu ťaháme cez existujúci proxy, ten istý, čo používa produkčná TV. */
  useEffect(() => {
    if (!maMenu) return;
    let zive = true;
    const nacitaj = async () => {
      try {
        const r = await fetch("/api/menu");
        if (!r.ok) return;
        const d = (await r.json()) as MenuData;
        if (zive) setMenu(d);
      } catch {
        /* keď ChoiceQR chvíľu nič nepošle, necháme na obrazovke to staré */
      }
    };
    nacitaj();
    const id = setInterval(nacitaj, MENU_MS);
    return () => {
      zive = false;
      clearInterval(id);
    };
  }, [maMenu]);

  /* Striedanie položiek. Beží podľa trvania práve zobrazenej položky. */
  const podpis = useMemo(
    () => items.map((i) => `${i.id}:${i.durationS}`).join(","),
    [items],
  );

  useEffect(() => {
    setIndex(0);
  }, [podpis]);

  useEffect(() => {
    if (items.length < 2) return;
    const trvanie = Math.max(3, items[index]?.durationS ?? 10) * 1000;
    casovac.current = setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      trvanie,
    );
    return () => {
      if (casovac.current) clearTimeout(casovac.current);
    };
  }, [index, items, podpis]);

  /* Kurzor zmizne, keď sa myš nehýbe — na TV nemá čo robiť. */
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const posun = () => {
      setBezKurzora(false);
      clearTimeout(id);
      id = setTimeout(() => setBezKurzora(true), 4000);
    };
    posun();
    window.addEventListener("mousemove", posun);
    return () => {
      window.removeEventListener("mousemove", posun);
      clearTimeout(id);
    };
  }, []);

  async function celuObrazovku() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* niektoré TV prehliadače to nedovolia — tlačidlo potom len nič neurobí */
    }
  }

  return (
    <div className={`prehravac${bezKurzora ? " prehravac--bez-kurzora" : ""}`}>
      {items.length === 0 && (
        <p className="prazdne">
          Obrazovka „{screen.name}" zatiaľ nemá nastavený žiadny obsah.
        </p>
      )}

      {items.map((it, i) => (
        <div
          className={`polozka${i === index ? " polozka--vidno" : ""}`}
          key={it.id}
          aria-hidden={i !== index}
        >
          {it.kind === "menu" ? (
            menu ? (
              <Board initial={menu} />
            ) : (
              <p className="prazdne">Menu se načítá…</p>
            )
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={it.mediaPath} alt="" />
          )}
        </div>
      ))}

      <button className="celu-obrazovku" onClick={celuObrazovku}>
        Celá obrazovka
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Over preklad**

Run: `npx tsc --noEmit`
Expected: bez chýb

- [ ] **Step 5: Vyskúšaj striedanie v prehliadači**

Otvor `http://localhost:4000/tv/hlavna`.
Expected: najprv menu, po 15 s slide „Akce dne", po 8 s späť menu, dokola.

- [ ] **Step 6: Over, že sa obrázok sťahuje len raz**

V prehliadači otvor záložku Network, filtruj `akce-dne.svg` a nechaj bežať
dve celé kolá.
Expected: **jedna** požiadavka, nie jedna na kolo. Ak ich je viac, položky sa
odpájajú z DOM a treba to opraviť — je to podmienka z návrhu, nie detail.

- [ ] **Step 7: Over, že sa zmena z adminu prejaví sama**

Nechaj `/tv/hlavna` otvorené, v druhom okne v adminovi zmeň trvanie slidu
na 20 s a ulož. Nerob nič s oknom TV.
Expected: do 15 sekúnd sa striedanie prispôsobí bez reloadu.

- [ ] **Step 8: Commit**

```bash
git add app/tv
git commit -m "Prehrávač obrazovky so striedaním menu a slidov"
```

---

### Task 13: Overenie, že sa produkcie nikto nedotkol

**Files:**
- Create: `tests/produkcia.test.ts`

- [ ] **Step 1: Napíš test, ktorý stráži produkčné súbory**

`tests/produkcia.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Na `main` beží klientovi TV v prevádzke. Tento test padne, keď sa na vetve
 * zmenil ktorýkoľvek zo súborov, z ktorých tá TV žije. Nie je to kozmetika —
 * je to jediná vec, ktorá nás upozorní, že sme siahli tam, kam nemáme.
 */
const CHRANENE = [
  "app/page.tsx",
  "app/board.tsx",
  "app/globals.css",
  "app/layout.tsx",
  "lib/menu.ts",
  "app/api/menu/route.ts",
];

describe("produkčné súbory", () => {
  it("sa oproti main nezmenili", () => {
    const zmenene = execFileSync(
      "git",
      ["diff", "--name-only", "main", "--", ...CHRANENE],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    expect(zmenene).toEqual([]);
  });
});
```

- [ ] **Step 2: Spusti a over, že prejde**

Run: `npm test`
Expected: PASS — zoznam zmenených produkčných súborov je prázdny

- [ ] **Step 3: Over, že test naozaj chytá zmeny**

```bash
echo "/* skuska */" >> app/globals.css && npm test; git checkout app/globals.css
```

Expected: test **padne** s výpisom `[ 'app/globals.css' ]`, potom sa zmena vráti
a `git status --short` už `app/globals.css` neukazuje.

- [ ] **Step 4: Spusti celú sadu testov a produkčný build**

```bash
lsof -ti:4000 | xargs kill -9 2>/dev/null
rm -rf .next node_modules/.cache
npm test && npm run build
```

Expected: všetky testy prejdú a build skončí bez chýb

- [ ] **Step 5: Naposledy porovnaj produkčnú stránku**

Spusti `npm run dev`, otvor `http://localhost:4000/` a porovnaj so
`https://ramen-brno.vercel.app`.
Expected: rovnaké — rovnaké stĺpce, štítky, veľkosti písma

- [ ] **Step 6: Commit**

```bash
git add tests/produkcia.test.ts
git commit -m "Test, ktorý stráži nedotknuteľnosť produkčných súborov"
```

---

## Čo po tejto etape nasleduje

Nič z tohto sa **nepushuje** — zostáva na vetve `tv-multiscreen`, kým to Marek
neodsúhlasí a neodskúša na skutočnej TV.

Ďalej podľa návrhu: 2. etapa (pripojenie Supabase, nahrávanie vlastných
obrázkov, video) a 3. etapa (menu na výšku).
