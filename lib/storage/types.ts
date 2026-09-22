export type Orientation = "landscape" | "portrait";

/** `video` sa spracováva až v 2. etape, typ je tu, aby sa model nemusel meniť */
export type ItemKind = "menu" | "image" | "video";

export type Transition = "fade" | "slide" | "zoom" | "none";

/**
 * Položky uložené pred zavedením prechodov pole `transition` nemajú. Preto sa
 * všade — pri čítaní z úložiska aj pri validácii v admin route — chýbajúca
 * alebo neznáma hodnota dopĺňa na `"fade"`, čo je pôvodné správanie.
 */
export type PlaylistItem = {
  id: string;
  kind: ItemKind;
  /** cesta k súboru; pri `menu` prázdny reťazec */
  mediaPath: string;
  /** ako dlho je položka vidieť, v sekundách */
  durationS: number;
  /** ako položka nastúpi na obrazovku */
  transition: Transition;
};

export type Screen = {
  id: string;
  slug: string;
  name: string;
  orientation: Orientation;
  items: PlaylistItem[];
  /** milisekundy; podľa nej TV pozná, že sa niečo zmenilo */
  updatedAt: number;
};

export type NewScreen = {
  name: string;
  slug: string;
  orientation: Orientation;
};

export type ScreenPatch = Partial<{
  name: string;
  slug: string;
  orientation: Orientation;
  items: PlaylistItem[];
}>;

/**
 * Chyby úložiska majú vlastné triedy zámerne. Routy z nich určujú HTTP stav
 * (404 / 409) cez `instanceof`, nie hádaním zo znenia hlášky — text sa dá
 * prepísať alebo preložiť, trieda nie. Každá ďalšia implementácia `Store`
 * (v 2. etape Supabase) MUSÍ hádzať práve tieto triedy, inak by admin začal
 * na neexistujúcu obrazovku vracať 409 namiesto 404.
 */
export class NotFoundError extends Error {
  constructor(message = "Obrazovka nenájdená") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class DuplicateSlugError extends Error {
  /** adresa, ktorá je už obsadená */
  readonly slug: string;

  constructor(slug: string) {
    super(`Obrazovka so slugom „${slug}" už existuje`);
    this.name = "DuplicateSlugError";
    this.slug = slug;
  }
}

/**
 * Jediné miesto, cez ktoré sa siaha na dáta. V 2. etape pribudne
 * implementácia nad Supabase; nič iné sa kvôli tomu meniť nebude.
 */
export interface Store {
  listScreens(): Promise<Screen[]>;
  getScreen(id: string): Promise<Screen | null>;
  getScreenBySlug(slug: string): Promise<Screen | null>;
  createScreen(input: NewScreen): Promise<Screen>;
  updateScreen(id: string, patch: ScreenPatch): Promise<Screen>;
  deleteScreen(id: string): Promise<void>;
}
