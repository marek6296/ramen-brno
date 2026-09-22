import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PRECHODY, PRECHODY_HODNOTY } from "@/lib/storage/types";
import { ANIMACIE, ANIMACIE_HODNOTY, animaciePre, SABLONY } from "@/lib/slides/types";

/**
 * Prechod je dvojica: položka v zozname a pravidlo v CSS prehrávača. Keď
 * jedno bez druhého, klient si v adminovi vyberie niečo, čo sa na televízore
 * potichu nestane — a nikto sa to nedozvie, lebo to nič nezhodí.
 */
const css = readFileSync(
  path.join(process.cwd(), "app/tv/[slug]/player.css"),
  "utf8",
);
const cssSlidov = readFileSync(
  path.join(process.cwd(), "app/slides/slides.css"),
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
    expect(PRECHODY.filter((p) => !p.skresluje).length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Prechod a animácia sú dve rôzne veci, ktoré sa ľahko popletú: prechod je,
 * AKO slide priletí a odletí (nastavuje sa pri obrazovke), animácia je, čo sa
 * deje NA slide, kým svieti (nastavuje sa pri slide). Keby sa animácie zase
 * stali nástupmi, klient by tú istú vec nastavoval dvakrát.
 */
describe("animácie slidu", () => {
  it("každá animácia má pravidlo v CSS slidov", () => {
    const bezPravidla = ANIMACIE_HODNOTY.filter(
      (h) => h !== "ziadna" && !cssSlidov.includes(`.slide--anim-${h}`),
    );
    expect(bezPravidla).toEqual([]);
  });

  it("v CSS nie je animácia, ktorá v zozname nie je", () => {
    const vCss = [...cssSlidov.matchAll(/\.slide--anim-([a-z-]+)/g)].map((m) => m[1]);
    const osirene = [...new Set(vCss)].filter(
      (v) => !ANIMACIE_HODNOTY.includes(v as (typeof ANIMACIE_HODNOTY)[number]),
    );
    expect(osirene).toEqual([]);
  });

  it("animácie bežia dokola, nie sú to jednorazové nástupy", () => {
    // Jednorazový nástup je prechod. Keby sa sem vrátil, zoznamy by sa
    // prekrývali a klient by nevedel, čo kde nastavuje.
    for (const a of ANIMACIE) {
      if (a.hodnota === "ziadna" || a.hodnota === "postupne") continue;
      const blok = cssSlidov.slice(cssSlidov.indexOf(`.slide--anim-${a.hodnota}`));
      expect(blok.slice(0, 220)).toContain("infinite");
    }
  });

  it("každá animácia má vysvetlenie pre obsluhu", () => {
    for (const a of ANIMACIE) expect(a.popisDlhy.length).toBeGreaterThan(5);
  });
});

describe("ponuka animácií podľa šablóny", () => {
  it("každá šablóna má z čoho vyberať", () => {
    for (const s of SABLONY) {
      expect(animaciePre(s.hodnota).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("pulzovanie sa neponúka tam, kde nie je čo rozsvietiť", () => {
    // Uvítanie a Oznámenie nemajú cenu ani štítok. Ponúknuť im pulzovanie
    // by znamenalo možnosť, po ktorej sa nestane nič — a to obsluha
    // prečíta ako pokazené.
    const pulz = (t: Parameters<typeof animaciePre>[0]) =>
      animaciePre(t).some((a) => a.hodnota === "zvyraznenie");
    expect(pulz("akcia")).toBe(true);
    expect(pulz("novinka")).toBe(true);
    expect(pulz("uvitanie")).toBe(false);
    expect(pulz("oznamenie")).toBe(false);
  });
});
