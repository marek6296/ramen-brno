import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DuplicateSlugError, NotFoundError } from "@/lib/storage/types";
import type { Store } from "@/lib/storage/types";

/**
 * Spoločná sada pre KAŽDÚ implementáciu `Store`. Popisuje správanie
 * rozhrania, nie to, kam sa dáta ukladajú — preto tu nie je ani slovo
 * o súboroch či o tabuľkách.
 *
 * Zmysel: keď v ďalšom kroku napojíme Supabase, spustíme na ňu presne tú istú
 * sadu. Čokoľvek, čo sa bude správať inak, vypadne hneď — a nie až na
 * televízore v prevádzke.
 *
 * `vyrob` musí vrátiť prázdne úložisko a funkciu `uprac`, ktorá po teste
 * zmaže, čo po ňom ostalo (priečinok, riadky v tabuľke — to je už vec
 * konkrétnej implementácie).
 */
export function skontrolujStore(
  nazov: string,
  vyrob: () => Promise<{ store: Store; uprac: () => Promise<void> }>,
) {
  describe(`kontrakt úložiska (${nazov})`, () => {
    let store: Store;
    let uprac: () => Promise<void>;

    beforeEach(async () => {
      ({ store, uprac } = await vyrob());
    });

    afterEach(async () => {
      await uprac();
    });

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

    it("nájde obrazovku podľa id", async () => {
      const s = await store.createScreen({
        name: "Hlavná",
        slug: "hlavna",
        orientation: "portrait",
      });
      expect(await store.getScreen(s.id)).toEqual(s);
    });

    it("na neznámy slug aj neznáme id vráti null, nie chybu", async () => {
      expect(await store.getScreenBySlug("niet-takej")).toBeNull();
      expect(await store.getScreen("niet-takej")).toBeNull();
    });

    it("nedovolí dva rovnaké slugy", async () => {
      await store.createScreen({
        name: "A",
        slug: "tv",
        orientation: "landscape",
      });
      await expect(
        store.createScreen({ name: "B", slug: "tv", orientation: "portrait" }),
      ).rejects.toThrow(DuplicateSlugError);
    });

    it("zoznam je zoradený podľa názvu", async () => {
      await store.createScreen({ name: "Cecil", slug: "c", orientation: "landscape" });
      await store.createScreen({ name: "Adam", slug: "a", orientation: "landscape" });
      await store.createScreen({ name: "Bruno", slug: "b", orientation: "landscape" });

      expect((await store.listScreens()).map((s) => s.name)).toEqual([
        "Adam",
        "Bruno",
        "Cecil",
      ]);
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

    it("úprava uloží položky aj s prechodmi", async () => {
      const s = await store.createScreen({
        name: "A",
        slug: "a",
        orientation: "landscape",
      });
      const po = await store.updateScreen(s.id, {
        items: [
          { id: "p1", kind: "menu", mediaPath: "", durationS: 30, transition: "slide", repeats: 1 },
          { id: "p2", kind: "image", mediaPath: "/a.png", durationS: 10, transition: "zoom", repeats: 1 },
        ],
      });
      expect(po.items.map((i) => i.transition)).toEqual(["slide", "zoom"]);
      expect((await store.getScreen(s.id))?.items).toEqual(po.items);
    });

    it("úprava neexistujúcej obrazovky padne", async () => {
      await expect(store.updateScreen("nieje", { name: "X" })).rejects.toThrow(
        NotFoundError,
      );
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
  });
}
