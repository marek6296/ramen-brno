import { describe, it, expect } from "vitest";
import { najdiJedla, jeSlidePrazdny } from "@/lib/slides/jedla";
import { polozkyAkcie } from "@/lib/slides/types";
import type { FieldsAkcia } from "@/lib/slides/types";
import type { Slide } from "@/lib/slides/types";
import type { Dish, MenuData } from "@/lib/menu";

const jedlo = (id: string, name: string) =>
  ({
    id, name, parts: [], partsEn: [], price: 100, allergens: [], labels: [],
    options: [], available: true, category: "RAMEN", categoryId: "c1",
  }) as unknown as Dish;

const menu = {
  left: [{ id: "g1", name: "CHUŤOVKY", dishes: [jedlo("a", "Edamame")] }],
  main: { name: "RAMEN", dishes: [jedlo("b", "NARUTO")] },
  right: [],
} as unknown as MenuData;

const akcia = (dishIds: string[]): Slide => ({
  id: "s1", name: "Akcia", template: "akcia", variant: "papier",
  animation: "ziadna", updatedAt: 1,
  fields: {
    nadpis: "AKCE", nadpisEn: "", dishIds, polozky: [], spojene: false,
    akciovaCena: "", podtext: "", podtextEn: "",
  },
});

describe("najdiJedla", () => {
  it("nájde jedlá naprieč všetkými kategóriami", () => {
    expect(najdiJedla(menu, ["b", "a"]).map((d) => d.name)).toEqual(["NARUTO", "Edamame"]);
  });

  it("jedlo, ktoré už v menu nie je, ticho vynechá", () => {
    expect(najdiJedla(menu, ["a", "zmizlo"]).map((d) => d.name)).toEqual(["Edamame"]);
  });

  it("bez menu vráti prázdno a nespadne", () => {
    expect(najdiJedla(null, ["a"])).toEqual([]);
  });
});

describe("jeSlidePrazdny", () => {
  it("akcia bez existujúcich jedál je prázdna", () => {
    expect(jeSlidePrazdny(akcia(["zmizlo"]), menu)).toBe(true);
  });

  it("akcia s aspoň jedným jedlom prázdna nie je", () => {
    expect(jeSlidePrazdny(akcia(["a", "zmizlo"]), menu)).toBe(false);
  });

  it("novinka bez existujúcich jedál je tiež prázdna", () => {
    // Novinka stojí na jedlách rovnako ako akcia. Keby sa na ňu zabudlo,
    // po odstránení jedla z ChoiceQR by na stene visel prázdny rámec.
    const n: Slide = {
      id: "s3", name: "Novinka", template: "novinka", variant: "papier",
      animation: "ziadna", updatedAt: 1,
      fields: { dishIds: ["zmizlo"], stitok: "NOVINKA", stitokEn: "NEW" },
    };
    expect(jeSlidePrazdny(n, menu)).toBe(true);
    expect(jeSlidePrazdny({ ...n, fields: { ...n.fields, dishIds: ["a"] } }, menu)).toBe(false);
  });

  it("oznámenie nie je prázdne nikdy — nestojí na jedlách", () => {
    const o: Slide = {
      id: "s4", name: "Oznámenie", template: "oznamenie", variant: "papier",
      animation: "ziadna", updatedAt: 1,
      fields: { text: "Dnes zavřeno", textEn: "", podtext: "", podtextEn: "" },
    };
    expect(jeSlidePrazdny(o, menu)).toBe(false);
    expect(jeSlidePrazdny(o, null)).toBe(false);
  });

  it("uvítanie nie je prázdne nikdy — nestojí na jedlách", () => {
    const u: Slide = {
      id: "s2", name: "Uvítanie", template: "uvitanie", variant: "papier",
      animation: "ziadna", updatedAt: 1,
      fields: { nazov: "RAMEN", kana: "", podtitul: "", podtitulEn: "", zobrazitHodiny: true },
    };
    expect(jeSlidePrazdny(u, menu)).toBe(false);
    expect(jeSlidePrazdny(u, null)).toBe(false);
  });
});

describe("položky akcie", () => {
  const pole = (o: Partial<FieldsAkcia>): FieldsAkcia => ({
    nadpis: "", nadpisEn: "", dishIds: [], polozky: [], spojene: false,
    akciovaCena: "", podtext: "", podtextEn: "", ...o,
  });

  it("akcia uložená pred zavedením položiek sa prečíta z dishIds", () => {
    // Bez toho by staré akcie zrazu nemali čo ukázať a museli by sa
    // migrovať dáta. Takto fungujú ďalej.
    expect(polozkyAkcie(pole({ dishIds: ["a", "b"] }))).toEqual([
      { druh: "jedlo", dishId: "a" },
      { druh: "jedlo", dishId: "b" },
    ]);
  });

  it("keď sú položky vyplnené, dishIds sa už nepozerá", () => {
    const f = pole({
      dishIds: ["stare"],
      polozky: [{ druh: "vlastna", text: "Kola", textEn: "" }],
    });
    expect(polozkyAkcie(f)).toEqual([{ druh: "vlastna", text: "Kola", textEn: "" }]);
  });

  const akciaSPolozkami = (polozky: FieldsAkcia["polozky"]): Slide => ({
    id: "s5", name: "Kombo", template: "akcia", variant: "papier",
    animation: "ziadna", updatedAt: 1, fields: pole({ polozky }),
  });

  it("akcia s vlastnou položkou nie je prázdna ani bez menu", () => {
    // „Coca-Cola" na ChoiceQR nestojí, takže je čo ukázať aj počas výpadku.
    const s = akciaSPolozkami([{ druh: "vlastna", text: "Kola", textEn: "" }]);
    expect(jeSlidePrazdny(s, menu)).toBe(false);
    expect(jeSlidePrazdny(s, null)).toBe(false);
  });

  it("akcia so zmiznutým jedlom a vlastnou položkou je stále plná", () => {
    const s = akciaSPolozkami([
      { druh: "jedlo", dishId: "zmizlo" },
      { druh: "vlastna", text: "Kola", textEn: "" },
    ]);
    expect(jeSlidePrazdny(s, menu)).toBe(false);
  });

  it("akcia len zo zmiznutých jedál je prázdna", () => {
    expect(jeSlidePrazdny(akciaSPolozkami([{ druh: "jedlo", dishId: "zmizlo" }]), menu)).toBe(
      true,
    );
  });
});
