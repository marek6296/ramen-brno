export type Orientation = "landscape" | "portrait";

/** ako sa má obraz otočiť; viď `rotation` na `Screen` */
export type Rotation = "none" | "left" | "right";

export type ItemKind = "menu" | "image" | "video" | "slide";

export type Transition =
  | "fade"
  | "fade-slow"
  | "fade-fast"
  | "slide"
  | "slide-left"
  | "slide-up"
  | "slide-down"
  | "zoom"
  | "zoom-in"
  | "none";

/**
 * Jediný zoznam prechodov — ponuka v adminovi aj validácia v oboch
 * úložiskách čítajú odtiaľto. Bol rozpísaný na troch miestach a nový
 * prechod by sa musel doplniť do každého; ktorý by sa zabudol, ten by
 * úložisko ticho prepísalo na „prelínanie".
 *
 * `posuva` znamená, že prechod hýbe obsahom cez `transform`. Menu si po
 * zobrazení meria vlastné rozmery, aby sa rozhodlo, či zhustiť sadzbu,
 * a transform mu tie rozmery skreslí — preto sa pri menu neponúka.
 */
export const PRECHODY: { hodnota: Transition; popis: string; posuva: boolean }[] = [
  { hodnota: "fade", popis: "Prelínanie", posuva: false },
  { hodnota: "fade-slow", popis: "Pomalé prelínanie", posuva: false },
  { hodnota: "fade-fast", popis: "Rýchle prelínanie", posuva: false },
  { hodnota: "slide", popis: "Posun sprava", posuva: true },
  { hodnota: "slide-left", popis: "Posun zľava", posuva: true },
  { hodnota: "slide-up", popis: "Posun zdola", posuva: true },
  { hodnota: "slide-down", popis: "Posun zhora", posuva: true },
  { hodnota: "zoom", popis: "Oddialenie", posuva: true },
  { hodnota: "zoom-in", popis: "Priblíženie", posuva: true },
  { hodnota: "none", popis: "Bez prechodu", posuva: false },
];

export const PRECHODY_HODNOTY: Transition[] = PRECHODY.map((p) => p.hodnota);

/**
 * Položky uložené pred zavedením prechodov pole `transition` nemajú. Preto sa
 * všade — pri čítaní z úložiska aj pri validácii v admin route — chýbajúca
 * alebo neznáma hodnota dopĺňa na `"fade"`, čo je pôvodné správanie.
 *
 * To isté platí pre `repeats`: staré uložené položky pole nemajú, preto sa
 * všade (lokálne úložisko, Supabase, admin route) chýbajúca alebo nezmyselná
 * hodnota dopĺňa na `1` — presne tak, ako to už robí `transition`.
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
  /** len pri `video`: koľkokrát sa má klip prehrať, než sa ide ďalej */
  repeats: number;
  /** len pri `slide`: odkaz do tabuľky slidov; inde prázdny reťazec */
  slideId: string;
};

export type Screen = {
  id: string;
  slug: string;
  name: string;
  orientation: Orientation;
  /**
   * Ako je televízor zavesený. Fyzicky otočená TV aj tak posiela obraz na
   * šírku, takže o 90° musí otočiť samotná stránka. `none` je pre prípad,
   * že by televízor otáčanie vedel sám.
   */
  rotation: Rotation;
  items: PlaylistItem[];
  /** milisekundy; podľa nej TV pozná, že sa niečo zmenilo */
  updatedAt: number;
};

export type NewScreen = {
  name: string;
  slug: string;
  orientation: Orientation;
  /** keď sa neuvedie, obrazovka vznikne bez otáčania */
  rotation?: Rotation;
};

export type ScreenPatch = Partial<{
  name: string;
  slug: string;
  orientation: Orientation;
  rotation: Rotation;
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
