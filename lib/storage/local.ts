import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DuplicateSlugError, NotFoundError } from "./types";
import type {
  NewScreen,
  PlaylistItem,
  Screen,
  ScreenPatch,
  Store,
  Transition,
} from "./types";

type Data = { screens: Screen[] };

const PRECHODY: Transition[] = ["fade", "slide", "zoom", "none"];

/**
 * Súbory uložené pred zavedením prechodov pole `transition` nemajú. Keby sme
 * ho nedoplnili, prehrávač by na `.polozka` nalepil triedu
 * `polozka--prechod-undefined` a položka by ostala bez prechodu. `"fade"` je
 * pôvodné správanie, takže staré obrazovky vyzerajú presne ako predtým.
 *
 * To isté platí pre `repeats` (počet prehratí videa): staré položky ho nemajú
 * a prehrávač by potom čakal na `undefined` prehratí, teda navždy. `1` je
 * pôvodné správanie — klip sa prehrá raz a ide sa ďalej.
 */
function dopln(it: PlaylistItem): PlaylistItem {
  const prechodSedi = PRECHODY.includes(it?.transition);
  const opakovaniaSedia = Number.isInteger(it?.repeats) && it.repeats >= 1;
  if (prechodSedi && opakovaniaSedia) return it;
  return {
    ...it,
    transition: prechodSedi ? it.transition : "fade",
    repeats: opakovaniaSedia ? it.repeats : 1,
  };
}

/**
 * Úložisko nad jedným JSON súborom. Slúži na vývoj a na skúšanie, kým klient
 * nemá Supabase. Zápis ide cez dočasný súbor a premenovanie, aby súbor
 * neostal poloprepísaný, keby sa proces vypol uprostred.
 */
export function createLocalStore(dir: string): Store {
  const file = path.join(dir, "store.json");

  async function read(): Promise<Data> {
    let obsah: string;
    try {
      obsah = await readFile(file, "utf8");
    } catch (e) {
      // Chýbajúci súbor je v poriadku — úložisko ešte nikto nezaložil.
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return { screens: [] };
      // Čokoľvek iné (práva, chybný disk) NESMIE vyzerať ako prázdne
      // úložisko. Najbližší zápis by prepísal všetky obrazovky klienta.
      throw new Error(
        `Úložisko ${file} sa nedá prečítať: ${(e as Error)?.message ?? e}`,
      );
    }

    try {
      const data = JSON.parse(obsah) as Data;
      const screens = data?.screens ?? [];
      return {
        screens: screens.map((s) => ({
          ...s,
          items: (s.items ?? []).map(dopln),
        })),
      };
    } catch (e) {
      // Poškodený JSON radšej nahlásime, než aby sme dáta ticho zahodili.
      throw new Error(
        `Úložisko ${file} je poškodené (nedá sa prečítať ako JSON): ${
          (e as Error)?.message ?? e
        }`,
      );
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
        throw new DuplicateSlugError(input.slug);
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
      if (i === -1) throw new NotFoundError();
      if (
        patch.slug &&
        data.screens.some((s) => s.slug === patch.slug && s.id !== id)
      ) {
        throw new DuplicateSlugError(patch.slug);
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
