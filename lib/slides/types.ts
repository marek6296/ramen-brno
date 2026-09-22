export type SlideTemplate = "akcia" | "uvitanie" | "oznamenie" | "novinka";
export type SlideVariant = "papier" | "tmava" | "oranzova";
export type SlideAnimation = "ziadna" | "nastup" | "text" | "zoom";

/** Polia šablóny Akcia. Anglické sú nepovinné — keď sú prázdne, riadok sa neukáže. */
export type FieldsAkcia = {
  nadpis: string;
  nadpisEn: string;
  /** id jedál z ChoiceQR; názov a cena sa ťahajú živo */
  dishIds: string[];
  /** zľavnená cena ako text — ChoiceQR ju nepozná, píše ju klient */
  akciovaCena: string;
  podtext: string;
  podtextEn: string;
};

export type FieldsUvitanie = {
  nazov: string;
  /** japonská ozdoba, napr. ラーメン */
  kana: string;
  podtitul: string;
  podtitulEn: string;
  /** otváracia doba sa ťahá živo z ChoiceQR, nezadáva sa */
  zobrazitHodiny: boolean;
};

/** Oznámenie: krátky odkaz hosťom. Nestojí na jedlách. */
export type FieldsOznamenie = {
  text: string;
  textEn: string;
  podtext: string;
  podtextEn: string;
};

/** Novinka: jedlo zo živého ChoiceQR so štítkom nad ním. */
export type FieldsNovinka = {
  /** id jedál z ChoiceQR; názov, popis aj cena sa ťahajú živo */
  dishIds: string[];
  /** štítok nad jedlom, napr. NOVINKA */
  stitok: string;
  stitokEn: string;
};

export type SlideFields =
  | FieldsAkcia
  | FieldsUvitanie
  | FieldsOznamenie
  | FieldsNovinka;

export type Slide = {
  id: string;
  name: string;
  template: SlideTemplate;
  variant: SlideVariant;
  animation: SlideAnimation;
  fields: SlideFields;
  /** milisekundy; podľa nej TV pozná zmenu, rovnako ako pri obrazovkách */
  updatedAt: number;
};

export type NewSlide = {
  name: string;
  template: SlideTemplate;
};

export type SlidePatch = Partial<{
  name: string;
  variant: SlideVariant;
  animation: SlideAnimation;
  fields: SlideFields;
}>;

export class SlideNotFoundError extends Error {
  constructor() {
    super("Slide nenájdený");
    this.name = "SlideNotFoundError";
  }
}

/**
 * Jediné miesto, cez ktoré sa siaha na slidy. Rovnaké delenie ako `Store`
 * pre obrazovky — implementácia sa dá vymeniť bez zásahu inde.
 */
export interface SlideStore {
  listSlides(): Promise<Slide[]>;
  getSlide(id: string): Promise<Slide | null>;
  getSlidesByIds(ids: string[]): Promise<Slide[]>;
  createSlide(input: NewSlide): Promise<Slide>;
  updateSlide(id: string, patch: SlidePatch): Promise<Slide>;
  deleteSlide(id: string): Promise<void>;
}

export const SABLONY: { hodnota: SlideTemplate; popis: string; kJedlam: boolean }[] = [
  { hodnota: "akcia", popis: "Akcia", kJedlam: true },
  { hodnota: "uvitanie", popis: "Uvítanie", kJedlam: false },
  { hodnota: "oznamenie", popis: "Oznámenie", kJedlam: false },
  { hodnota: "novinka", popis: "Novinka", kJedlam: true },
];

/**
 * Stojí šablóna na jedlách z ChoiceQR? Odpoveď je `kJedlam` v `SABLONY`, aby
 * bola na jedinom mieste. Keby sa to písalo zvlášť tam, kde sa rozhoduje
 * o prázdnom slide, ďalšia šablóna s jedlami by sa na to ticho zabudla
 * a na stene by visel prázdny rámec.
 */
export function stojiNaJedlach(t: SlideTemplate): boolean {
  return SABLONY.find((s) => s.hodnota === t)?.kJedlam ?? false;
}

export const VARIANTY: { hodnota: SlideVariant; popis: string }[] = [
  { hodnota: "papier", popis: "Papier" },
  { hodnota: "tmava", popis: "Tmavá" },
  { hodnota: "oranzova", popis: "Oranžová" },
];

export const ANIMACIE: { hodnota: SlideAnimation; popis: string }[] = [
  { hodnota: "ziadna", popis: "Bez animácie" },
  { hodnota: "nastup", popis: "Jemný nástup" },
  { hodnota: "text", popis: "Odkrývanie textu" },
  { hodnota: "zoom", popis: "Pomalý zoom" },
];

export function prazdneFields(t: SlideTemplate): SlideFields {
  switch (t) {
    case "akcia":
      return { nadpis: "", nadpisEn: "", dishIds: [], akciovaCena: "", podtext: "", podtextEn: "" };
    case "uvitanie":
      return { nazov: "", kana: "", podtitul: "", podtitulEn: "", zobrazitHodiny: true };
    case "oznamenie":
      return { text: "", textEn: "", podtext: "", podtextEn: "" };
    case "novinka":
      // Štítok predvyplnený — klient ho môže prepísať, ale nemusí naň myslieť.
      return { dishIds: [], stitok: "NOVINKA", stitokEn: "NEW" };
  }
}
