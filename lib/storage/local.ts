import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DuplicateSlugError, NotFoundError } from "./types";
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
