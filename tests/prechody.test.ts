import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PRECHODY, PRECHODY_HODNOTY } from "@/lib/storage/types";

/**
 * Prechod je dvojica: položka v zozname a pravidlo v CSS prehrávača. Keď
 * jedno bez druhého, klient si v adminovi vyberie niečo, čo sa na televízore
 * potichu nestane — a nikto sa to nedozvie, lebo to nič nezhodí.
 */
const css = readFileSync(
  path.join(process.cwd(), "app/tv/[slug]/player.css"),
  "utf8",
);

describe("prechody medzi položkami", () => {
  it("každý prechod zo zoznamu má pravidlo v CSS prehrávača", () => {
    const bezPravidla = PRECHODY_HODNOTY.filter(
      (h) => !css.includes(`.polozka--prechod-${h}`),
    );
    expect(bezPravidla).toEqual([]);
  });

  it("v CSS nie je pravidlo pre prechod, ktorý v zozname nie je", () => {
    const vCss = [...css.matchAll(/\.polozka--prechod-([a-z-]+)[ .{]/g)].map(
      (m) => m[1],
    );
    const osirene = [...new Set(vCss)].filter(
      (v) => !PRECHODY_HODNOTY.includes(v as (typeof PRECHODY_HODNOTY)[number]),
    );
    expect(osirene).toEqual([]);
  });

  it("zoznam nemá dve položky s rovnakou hodnotou ani popisom", () => {
    expect(new Set(PRECHODY.map((p) => p.hodnota)).size).toBe(PRECHODY.length);
    expect(new Set(PRECHODY.map((p) => p.popis)).size).toBe(PRECHODY.length);
  });

  it("menu má na výber aspoň dva prechody, ktoré ním nehýbu", () => {
    // Transform skresľuje meraniu sadzby rozmery, preto sa pri menu neponúka.
    // Keby ich nezostalo, klient by pri menu nemal z čoho vyberať.
    expect(PRECHODY.filter((p) => !p.posuva).length).toBeGreaterThanOrEqual(2);
  });
});
