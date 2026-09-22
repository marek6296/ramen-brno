import { describe, it, expect } from "vitest";
import {
  deleteMedia,
  listMedia,
  ocistiNazovSuboru,
  uploadMedia,
} from "@/lib/media";

describe("očistenie názvu súboru", () => {
  it("zhodí diakritiku aj medzery, príponu nechá", () => {
    expect(ocistiNazovSuboru("Akčná ponuka.JPG", 1000)).toBe(
      "1000-akcna-ponuka.jpg",
    );
  });

  it("pred názov dá pečiatku, takže sa dve rovnaké nahratia neprepíšu", () => {
    const a = ocistiNazovSuboru("menu.png", 1);
    const b = ocistiNazovSuboru("menu.png", 2);
    expect(a).not.toBe(b);
  });

  it("z názvu bez použiteľných znakov spraví neutrálny názov", () => {
    expect(ocistiNazovSuboru("東京.mp4", 5)).toBe("5-subor.mp4");
  });

  it("v názve neostanú znaky, ktoré by sa museli v adrese kódovať", () => {
    const n = ocistiNazovSuboru("a b/c?d#e.webp", 7);
    expect(n).toBe(encodeURIComponent(n));
  });
});

/**
 * Kolobeh proti ŽIVÉMU bucketu: nahrať → nájsť vo výpise → zmazať.
 * Beží len s prístupovými údajmi v prostredí, inak sa preskočí (rovnako ako
 * testy úložiska). Po sebe upratuje a dotýka sa výhradne vlastného súboru.
 */
const url = process.env.SUPABASE_URL;
const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !kluc) {
  describe("médiá v Supabase Storage", () => {
    it.skip("preskočené — nie sú nastavené SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
} else {
  describe("médiá v Supabase Storage", () => {
    it("nahratý súbor sa objaví vo výpise a dá sa zmazať", async () => {
      // najmenší platný PNG, aby sa nahrával skutočný obrázok a nie text
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      );
      const data = png.buffer.slice(
        png.byteOffset,
        png.byteOffset + png.byteLength,
      ) as ArrayBuffer;

      const nahraty = await uploadMedia("test čajka.png", "image/png", data);
      try {
        expect(nahraty.kind).toBe("image");
        expect(nahraty.url).toContain("/storage/v1/object/public/tv-media/");

        const zoznam = await listMedia();
        expect(zoznam.map((m) => m.path)).toContain(nahraty.path);
      } finally {
        await deleteMedia(nahraty.path);
      }

      const poZmazani = await listMedia();
      expect(poZmazani.map((m) => m.path)).not.toContain(nahraty.path);
    });

    it("mazanie mimo bucketu odmietne", async () => {
      await expect(deleteMedia("../screens/nieco.png")).rejects.toThrow(
        /Neplatný názov/,
      );
    });
  });
}
