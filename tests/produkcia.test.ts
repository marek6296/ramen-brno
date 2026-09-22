import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Na `main` beží klientovi TV v prevádzke. Tento test padne, keď sa na vetve
 * zmenil ktorýkoľvek zo súborov, z ktorých tá TV žije. Nie je to kozmetika —
 * je to jediná vec, ktorá nás upozorní, že sme siahli tam, kam nemáme.
 */
const CHRANENE = [
  "app/page.tsx",
  "app/board.tsx",
  "app/globals.css",
  "app/layout.tsx",
  "lib/menu.ts",
  "app/api/menu/route.ts",
];

describe("produkčné súbory", () => {
  it("sa oproti main nezmenili", () => {
    const zmenene = execFileSync(
      "git",
      ["diff", "--name-only", "main", "--", ...CHRANENE],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    expect(zmenene).toEqual([]);
  });
});
