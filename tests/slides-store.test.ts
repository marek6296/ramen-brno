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
