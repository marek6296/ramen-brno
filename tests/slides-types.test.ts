import { describe, it, expect } from "vitest";
import { prazdneFields, SABLONY, stojiNaJedlach } from "@/lib/slides/types";

describe("tvary slidov", () => {
  it("pozná všetky štyri šablóny", () => {
    expect(SABLONY.map((s) => s.hodnota)).toEqual([
      "akcia",
      "uvitanie",
      "oznamenie",
      "novinka",
    ]);
  });

  it("vie, ktoré šablóny stoja na jedlách", () => {
    // Podľa tohto sa pozná prázdny slide. Keby Novinka vypadla, na stene by
    // pri zmiznutom jedle visel prázdny rámec.
    expect(SABLONY.filter((s) => s.kJedlam).map((s) => s.hodnota)).toEqual([
      "akcia",
      "novinka",
    ]);
    expect(stojiNaJedlach("novinka")).toBe(true);
    expect(stojiNaJedlach("oznamenie")).toBe(false);
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

  it("nové oznámenie má prázdne oba jazyky", () => {
    expect(prazdneFields("oznamenie")).toEqual({
      text: "",
      textEn: "",
      podtext: "",
      podtextEn: "",
    });
  });

  it("nová novinka má predvyplnený štítok a žiadne jedlá", () => {
    expect(prazdneFields("novinka")).toEqual({
      dishIds: [],
      stitok: "NOVINKA",
      stitokEn: "NEW",
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
