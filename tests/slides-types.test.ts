import { describe, it, expect } from "vitest";
import { prazdneFields, SABLONY } from "@/lib/slides/types";

describe("tvary slidov", () => {
  it("pozná obe šablóny 1. etapy", () => {
    expect(SABLONY.map((s) => s.hodnota)).toEqual(["akcia", "uvitanie"]);
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
