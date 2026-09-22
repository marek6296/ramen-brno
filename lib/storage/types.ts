export type Orientation = "landscape" | "portrait";

/** `video` sa spracováva až v 2. etape, typ je tu, aby sa model nemusel meniť */
export type ItemKind = "menu" | "image" | "video";

export type PlaylistItem = {
  id: string;
  kind: ItemKind;
  /** cesta k súboru; pri `menu` prázdny reťazec */
  mediaPath: string;
  /** ako dlho je položka vidieť, v sekundách */
  durationS: number;
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
