/**
 * ChoiceQR public menu adapter — MENU DO RESTAURACE (dine-in).
 *
 * DÔLEŽITÉ: reštaurácia má v ChoiceQR dve menu (areaSwitcher):
 *   - takeaway (/takeaway) = rozvoz / vyzdvihnutie  -> kategórie TAKEAWAY, NÁPOJE, ALKOHOL
 *   - dineIn   (/menu)     = menu v prevádzke       -> CHUŤOVKY, RAMEN, DĚTSKÉ JÍDLO, DEZERT
 *
 * Na TV chceme to DRUHÉ. API ho vráti len vtedy, keď pošleme hlavičku
 * `Referer: <BASE>/menu` — inak ticho vráti takeaway menu (200 OK, iné dáta).
 * Overené: 5/5 volaní vráti správne menu, funguje aj `?lang=en`.
 *
 * Ďalšie pasce ChoiceQR:
 *   - ceny sú v halieroch (7700 = 77 Kč)
 *   - žiadne CORS hlavičky -> volať zo servera, nie z prehliadača
 *   - jazyk IBA cez `?lang=en` (`?language=`, `Accept-Language` sa ignorujú)
 *   - „vypredané" je v `attributes: ["SOLD_OUT"]`, NIE v `available`
 */

const BASE = process.env.CHOICEQR_BASE ?? "https://vaclavska.ramen-brno.cz";

/** bez tejto hlavičky dostaneme rozvozové menu namiesto reštauračného */
const DINE_IN_REFERER = `${BASE}/menu`;

export type Label =
  | "vegetarian"
  | "vegan"
  | "gluten"
  | "spicy"
  | "middle-spicy"
  | "hot-spicy"
  | "new"
  | "recommended"
  | (string & {});

export type OptionItem = { name: string; nameEn?: string; price: number };
export type OptionGroup = {
  id: string;
  name: string;
  nameEn?: string;
  required: boolean;
  items: OptionItem[];
};

export type Dish = {
  id: string;
  name: string;
  nameEn?: string;
  /** popis rozsekaný po čiarkach — každý kus sa zalamuje ako celok */
  parts: string[];
  partsEn: string[];
  price: number; // v Kč
  weight?: string;
  kcal?: number;
  /** základná škála 1–14, bez poddruhov (1.1 -> 1), zoradené */
  allergens: number[];
  labels: Label[];
  image?: string;
  options: OptionGroup[];
  available: boolean;
  category: string;
  categoryId: string;
};

/** kategória tak, ako ju klient nazval v ChoiceQR — názov berieme z dát */
export type Group = {
  id: string;
  name: string;
  nameEn?: string;
  dishes: Dish[];
};

export type MenuData = {
  updatedAt: string;
  currency: string;
  place: { name: string; logo?: string; background?: string; opened: boolean };
  workTime?: { from: string; till: string };
  /** kategórie do ľavého krajného stĺpca */
  left: Group[];
  /** najväčšia kategória (typicky RAMEN) — jeden široký blok v strede,
   *  do dvoch podstĺpcov ju rozloží CSS, poradie ostáva z ChoiceQR */
  main: { name: string; nameEn?: string; dishes: Dish[] } | null;
  /** kategórie do pravého krajného stĺpca */
  right: Group[];
  /** povinné voľby (napr. druh nudlí) — vlastná sekcia nad prídavkami */
  choices: OptionGroup[];
  /** nepovinné doplnky — box PŘÍDAVKY */
  extras: OptionGroup[];
};

/* ------------------------------------------------------------------ */

// nutričná veta začína prvým "NNN kcal/"
const NUTRI = /(\d[\d\s.,]*\s?kcal\/.*)$/s;

/**
 * Vytiahne z popisu čistý text bez nutričných údajov.
 * Pozor na Edamame: popis je "ochucené sójové boby  Chilli: 190 kcal/... Sezam: 219 kcal/..."
 * -> po odseknutí nutričnej vety ostane visieť "Chilli:", to treba odstrániť.
 */
function cleanDesc(raw?: string): string {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  const m = text.match(NUTRI);
  if (m) text = text.slice(0, m.index);
  return text
    .replace(/\s*\p{Lu}[\p{L}\s]*:\s*$/u, "") // visiaci nadpis typu "Chilli:"
    .replace(/[,;\s]+$/, "")
    .trim();
}

/** popis je zoznam ingrediencií oddelený čiarkami -> rozsekať na kusy,
 *  aby sa riadok lámal len na čiarke a „čajové vejce" sa nikdy nerozdelilo */
function toParts(raw?: string): string[] {
  const t = cleanDesc(raw);
  if (!t) return [];
  return t
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "CHUŤOVKY - Edamame" -> "Edamame" */
function stripPrefix(name: string) {
  return name.replace(/^[A-ZÁ-Ž\s]{4,}\s[-–]\s/u, "").trim();
}

/** ChoiceQR posiela pri duplikovaných položkách názvy typu "NARUTO RAMEN Copy" */
function cleanName(name: string) {
  return stripPrefix(name).replace(/\s+Copy$/i, "").trim();
}

/**
 * Alergény: Choice pridal poddruhy (1.1, 1.2 = rôzne zdroje lepku).
 * Klient chce len základnú škálu 1–14 -> zaokrúhliť nadol, odstrániť duplicity, zoradiť.
 */
function normalizeAllergens(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const base = raw
    .map((a) => Math.floor(Number(a)))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 14);
  return [...new Set(base)].sort((a, b) => a - b);
}

function toDish(raw: any, en: any | undefined, catName: string): Dish {
  const media = raw.media?.[0];
  const soldOut =
    Array.isArray(raw.attributes) && raw.attributes.includes("SOLD_OUT");
  return {
    id: raw._id,
    name: cleanName(raw.name ?? ""),
    nameEn: en ? cleanName(en.name ?? "") : undefined,
    parts: toParts(raw.description),
    partsEn: toParts(en?.description),
    price: Math.round((raw.price ?? 0) / 100),
    weight: raw.weight ? `${raw.weight}${raw.weightType ?? ""}` : undefined,
    kcal: raw.kcal || undefined,
    allergens: normalizeAllergens(raw.allergens),
    labels: (raw.menu_labels ?? []).map((l: any) => l.type),
    image: media?.webp?.medium ?? media?.medium ?? media?.url,
    options: (raw.menu_options ?? [])
      .filter((o: any) => o.active)
      .map((o: any, i: number): OptionGroup => ({
        id: o._id,
        name: o.name,
        nameEn: en?.menu_options?.[i]?.name,
        required: !!o.required,
        items: (o.list ?? []).map((l: any, k: number) => ({
          name: l.name,
          nameEn: en?.menu_options?.[i]?.list?.[k]?.name,
          price: Math.round((l.price ?? 0) / 100),
        })),
      })),
    available: raw.available !== false && !soldOut,
    category: catName,
    categoryId: raw.category,
  };
}

async function fetchLang(lang?: "en") {
  const url = `${BASE}/api/public/menu${lang ? `?lang=${lang}` : ""}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      // BEZ TOHTO dostaneme rozvozové menu — nie to reštauračné!
      referer: DINE_IN_REFERER,
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`ChoiceQR ${url} -> ${res.status}`);
  return res.json();
}

export async function getMenu(): Promise<MenuData> {
  const [cz, en] = await Promise.all([
    fetchLang(),
    fetchLang("en").catch(() => null),
  ]);

  const cats: Record<string, string> = {};
  for (const c of cz.categories ?? []) cats[c._id] = c.name;

  const enById: Record<string, any> = {};
  for (const m of en?.menu ?? []) enById[m._id] = m;

  const dishes: Dish[] = (cz.menu ?? []).map((m: any) =>
    toDish(m, enById[m._id], cats[m.category] ?? "")
  );

  // ---- rozloženie do stĺpcov, BEZ závislosti na názvoch kategórií ----
  //
  // Klient si môže kategórie v ChoiceQR kedykoľvek premenovať, pridať alebo
  // zmazať. Preto sa na názvy vôbec nespoliehame — pracujeme len s tým,
  // čo API vráti, a v pôvodnom poradí z admina (klient si ho tam ťahá myšou):
  //   - najväčšia kategória  -> dva stredné stĺpce (u nich RAMEN)
  //   - ostatné              -> rozdelené medzi ľavý a pravý krajný stĺpec
  //                             tak, aby boli podobne plné
  const enCatById: Record<string, string> = {};
  for (const c of en?.categories ?? []) enCatById[c._id] = c.name;

  const groups: Group[] = (cz.categories ?? [])
    .map((c: any) => ({
      id: c._id,
      name: c.name,
      nameEn: enCatById[c._id],
      dishes: dishes.filter((d) => d.categoryId === c._id),
    }))
    .filter((g: Group) => g.dishes.length > 0);

  // najväčšia kategória ide do stredu
  const mainGroup =
    groups.length > 0
      ? groups.reduce((a, b) => (b.dishes.length > a.dishes.length ? b : a))
      : null;

  const rest = groups.filter((g) => g !== mainGroup);
  const catOrder = new Map(groups.map((g, i) => [g.id, i]));

  // ostatné kategórie rozhádžeme na kraje tak, aby boli strany vyrovnané
  const sides: Group[][] = [[], []];
  const count = [0, 0];
  for (const g of [...rest].sort((a, b) => b.dishes.length - a.dishes.length)) {
    const i = count[0] <= count[1] ? 0 : 1;
    sides[i].push(g);
    count[i] += g.dishes.length;
  }
  const byAdminOrder = (a: Group, b: Group) =>
    (catOrder.get(a.id) ?? 0) - (catOrder.get(b.id) ?? 0);
  const left = sides[0].sort(byAdminOrder);
  const right = sides[1].sort(byAdminOrder);

  const ramen = mainGroup ? mainGroup.dishes : [];

  // ---- voľby a prídavky ----
  //
  // Zbierame skupiny volieb naprieč VŠETKÝMI jedlami (medzi jedlami sa líšia,
  // brať len z prvého by niektoré zahodilo). Položky za 0 Kč necháme — pri
  // povinnej voľbe je práve tá nulová tou základnou (RAMEN NUDLE naší výroby).
  //
  // O zobrazení sekcie rozhoduje to, či sada patrí k hlavnej kategórii (ramenom)
  // — teda či naozaj platí „k akejkoľvek miske". CENY do toho nevstupujú:
  // keď klient vypne jednu položku (napr. rýžové nudle), sekcia musí ostať
  // a zmizne len tá jedna položka. Sekcia zmizne až vtedy, keď klient vypne
  // celú sadu alebo v nej nezostane nič.
  const mainDishIds = new Set((mainGroup?.dishes ?? []).map((d) => d.id));
  type Agg = OptionGroup & { onMain: boolean };
  const agg = new Map<string, Agg>();
  for (const d of dishes) {
    for (const g of d.options) {
      if (/příbor|pribor|cutlery/i.test(g.name)) continue;
      if (!g.items.length) continue;
      const key = g.name.trim().toLowerCase();
      const existing = agg.get(key);
      if (existing) {
        existing.onMain = existing.onMain || mainDishIds.has(d.id);
        for (const it of g.items) {
          if (!existing.items.some((x) => x.name === it.name)) existing.items.push(it);
        }
      } else {
        agg.set(key, {
          ...g,
          items: [...g.items],
          onMain: mainDishIds.has(d.id),
        });
      }
    }
  }
  // Sady pripnuté len k jedlám mimo hlavnej kategórie (napr. voľba dochutenia
  // pri chuťovke) sem nepatria — platia len pre to jedlo a na spoločnej tabuli
  // by mýlili.
  const shared = [...agg.values()].filter((g) => g.onMain);

  // povinná voľba (napr. druh nudlí) dostane vlastnú sekciu,
  // nepovinné doplnky idú do boxu PŘÍDAVKY
  const choices: OptionGroup[] = shared.filter((g) => g.required);
  const extras: OptionGroup[] = shared.filter((g) => !g.required);

  // Hlavná kategória ide do jedného širokého bloku s jedným nadpisom.
  // Do dvoch podstĺpcov ju rozloží CSS (`column-count: 2`) — text tečie zhora
  // nadol v ľavom a pokračuje v pravom, takže PORADIE Z CHOICEQR ostáva zachované
  // a stĺpce sa vyvážia samy.

  return {
    updatedAt: new Date().toISOString(),
    currency: cz.place?.currencyLabel ?? "Kč",
    place: {
      name: cz.place?.name ?? "Ramen",
      logo: cz.place?.companyImages?.logo,
      background: cz.template?.styles?.background?.value?.url,
      opened: !!cz.place?.opened,
    },
    workTime: cz.place?.workTime
      ? { from: cz.place.workTime.from, till: cz.place.workTime.till }
      : undefined,
    left,
    main: mainGroup
      ? {
          name: mainGroup.name,
          nameEn: mainGroup.nameEn,
          dishes: ramen, // v poradí z ChoiceQR
        }
      : null,
    right,
    choices,
    extras,
  };
}
