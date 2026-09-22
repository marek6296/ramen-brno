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
