import { afterEach, describe, expect, it, vi } from "vitest";
import { getMenu } from "@/lib/menu";

/** surová odpoveď ChoiceQR — len polia, ktoré adaptér naozaj číta */
function odpoved(kategorie: { id: string; name: string; jedal: number; volby?: boolean }[]) {
  return {
    place: { name: "Ramen", opened: true },
    categories: kategorie.map((k) => ({ _id: k.id, name: k.name })),
    menu: kategorie.flatMap((k) =>
      Array.from({ length: k.jedal }, (_, i) => ({
        _id: `${k.id}-${i}`,
        category: k.id,
        name: `${k.name} ${i}`,
        description: "vývar, nudle",
        price: 10000,
        menu_options: k.volby
          ? [
              {
                _id: "nudle",
                active: true,
                required: true,
                name: "NUDLE",
                list: [{ name: "RAMEN NUDLE", price: 0 }],
              },
              {
                _id: "extras",
                active: true,
                required: false,
                name: "EXTRAS",
                list: [{ name: "VEJCE", price: 2000 }],
              },
            ]
          : [],
      })),
    ),
  };
}

function podstrc(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rozloženie menu do stĺpcov", () => {
  it("rameny sú v strede, aj keď je chuťoviek viac (súkromná akcia)", async () => {
    // Presne stav z 20. 11.: klient nechal 2 rameny a 3 chuťovky. Najväčšia
    // kategória by poslala do stredu chuťovky a NUDLE s prídavkami by zmizli.
    podstrc(
      odpoved([
        { id: "r", name: "RAMEN", jedal: 2, volby: true },
        { id: "c", name: "CHUŤOVKY", jedal: 3 },
      ]),
    );
    const m = await getMenu();
    expect(m.main?.name).toBe("RAMEN");
    expect(m.left.map((g) => g.name)).toEqual(["CHUŤOVKY"]);
    expect(m.choices.map((g) => g.name)).toEqual(["NUDLE"]);
    expect(m.extras.map((g) => g.name)).toEqual(["EXTRAS"]);
  });

  it("bez kategórie ramenov ide do stredu najväčšia kategória", async () => {
    podstrc(
      odpoved([
        { id: "a", name: "POLÉVKY", jedal: 4 },
        { id: "b", name: "CHUŤOVKY", jedal: 2 },
      ]),
    );
    expect((await getMenu()).main?.name).toBe("POLÉVKY");
  });
});
