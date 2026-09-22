export type SlideTemplate = "akcia" | "uvitanie";
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

export type SlideFields = FieldsAkcia | FieldsUvitanie;

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
];

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
  return t === "akcia"
    ? { nadpis: "", nadpisEn: "", dishIds: [], akciovaCena: "", podtext: "", podtextEn: "" }
    : { nazov: "", kana: "", podtitul: "", podtitulEn: "", zobrazitHodiny: true };
}
