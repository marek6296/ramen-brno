import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLocalStore } from "@/lib/storage/local";
import { skontrolujStore } from "./store-kontrakt";

// Spoločná sada pre každú implementáciu `Store`. Tá istá sa v ďalšom kroku
// spustí nad Supabase — a hneď ukáže, či sa správa rovnako.
skontrolujStore("lokálny súbor", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tvstore-"));
  return {
    store: createLocalStore(dir),
    uprac: () => rm(dir, { recursive: true, force: true }),
  };
});

/**
 * Nižšie ostávajú LEN testy, ktoré sú naozaj o súbore. Do spoločnej sady
 * nepatria — Supabase žiadny `store.json` nemá.
 */
describe("lokálne úložisko (súborové zvláštnosti)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "tvstore-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("dáta prežijú nový store nad tým istým priečinkom", async () => {
    const store = createLocalStore(dir);
    await store.createScreen({ name: "A", slug: "a", orientation: "landscape" });
    const druhy = createLocalStore(dir);
    expect(await druhy.listScreens()).toHaveLength(1);
  });

  it("poškodený súbor padne a netvári sa ako prázdne úložisko", async () => {
    const store = createLocalStore(dir);
    await writeFile(path.join(dir, "store.json"), "toto nie je JSON", "utf8");
    // Keby sa vrátil prázdny zoznam, najbližší zápis by prepísal všetky
    // obrazovky klienta — tichá strata dát.
    await expect(store.listScreens()).rejects.toThrow(/poškoden/i);
  });

  it("starej položke bez prechodu doplní fade a bez opakovaní jedno", async () => {
    // Presne taký tvar má `.data/store.json` klienta spred zavedenia
    // prechodov. Keby sa pole nedoplnilo, prehrávač by položke nalepil
    // triedu `polozka--prechod-undefined` a nenastúpila by. To isté platí
    // pre `repeats` — bez neho by prehrávač pri videu čakal na `undefined`
    // prehratí, teda navždy.
    const store = createLocalStore(dir);
    await writeFile(
      path.join(dir, "store.json"),
      JSON.stringify({
        screens: [
          {
            id: "stara",
            slug: "stara",
            name: "Stará",
            orientation: "landscape",
            updatedAt: 1,
            items: [
              { id: "p1", kind: "menu", mediaPath: "", durationS: 30 },
              { id: "p2", kind: "image", mediaPath: "/a.png", durationS: 10 },
              // video s prechodom, ale bez počtu prehratí — presne tak, ako
              // to vyzerá v súbore uloženom pred touto zmenou
              {
                id: "p3",
                kind: "video",
                mediaPath: "/klip.mp4",
                durationS: 15,
                transition: "zoom",
              },
              // nezmyselný počet prehratí musí skončiť rovnako ako chýbajúci
              {
                id: "p4",
                kind: "video",
                mediaPath: "/klip2.mp4",
                durationS: 15,
                transition: "fade",
                repeats: 0,
              },
            ],
          },
        ],
      }),
      "utf8",
    );

    const s = await store.getScreenBySlug("stara");
    expect(s?.items.map((i) => i.transition)).toEqual([
      "fade",
      "fade",
      "zoom",
      "fade",
    ]);
    expect(s?.items.map((i) => i.repeats)).toEqual([1, 1, 1, 1]);
  });
});
