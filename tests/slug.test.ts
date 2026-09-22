import { describe, it, expect } from "vitest";
import { normalizeSlug } from "@/lib/storage/slug";

describe("normalizeSlug", () => {
  it("zhodí diakritiku a medzery", () => {
    expect(normalizeSlug("TV pri báre")).toBe("tv-pri-bare");
  });

  it("zhodí zvláštne znaky", () => {
    expect(normalizeSlug("Menu #1 / hlavná!")).toBe("menu-1-hlavna");
  });

  it("neostanú pomlčky na krajoch", () => {
    expect(normalizeSlug("  --menu--  ")).toBe("menu");
  });

  it("prázdny vstup dá prázdny výstup", () => {
    expect(normalizeSlug("???")).toBe("");
  });

  it("obmedzí dĺžku na 40 znakov", () => {
    expect(normalizeSlug("a".repeat(60))).toHaveLength(40);
  });
});
