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
