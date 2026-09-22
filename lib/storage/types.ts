export type Orientation = "landscape" | "portrait";

/** ako sa má obraz otočiť; viď `rotation` na `Screen` */
export type Rotation = "none" | "left" | "right";

export type ItemKind = "menu" | "image" | "video" | "slide";

export type Transition =
  | "fade"
  | "fade-slow"
  | "fade-fast"
  | "push-left"
  | "push-right"
  | "push-up"
  | "push-down"
  | "cover-left"
  | "cover-up"
  | "reveal-left"
  | "zoom"
  | "zoom-in"
  | "none";

/**
 * Jediný zoznam prechodov — ponuka v adminovi aj validácia v úložiskách
 * a v API čítajú odtiaľto. Bol rozpísaný na štyroch miestach a ten, na ktorý
 * sa zabudlo, ticho prepisoval nové prechody na „prelínanie“.
 *
 * `skresluje` znamená, že prechod mení ROZMER obsahu. Menu si po zobrazení
 * meria vlastnú výšku, aby sa rozhodlo, či zhustiť sadzbu — a zväčšenie mu
 * tú výšku skreslí. Posun ju nemení (overené: translate nechá
 * `getBoundingClientRect().height` na mieste, scale ju roztiahne), takže
 * vytláčanie aj nasúvanie sa pri menu pokojne použiť dá.
 */
export const PRECHODY: { hodnota: Transition; popis: string; skresluje: boolean }[] = [
  { hodnota: "fade", popis: "Prelínanie", skresluje: false },
  { hodnota: "fade-slow", popis: "Pomalé prelínanie", skresluje: false },
  { hodnota: "fade-fast", popis: "Rýchle prelínanie", skresluje: false },
  { hodnota: "push-left", popis: "Vytlačenie doľava", skresluje: false },
  { hodnota: "push-right", popis: "Vytlačenie doprava", skresluje: false },
  { hodnota: "push-up", popis: "Vytlačenie nahor", skresluje: false },
  { hodnota: "push-down", popis: "Vytlačenie nadol", skresluje: false },
  { hodnota: "cover-left", popis: "Nasunutie sprava", skresluje: false },
  { hodnota: "cover-up", popis: "Nasunutie zdola", skresluje: false },
  { hodnota: "reveal-left", popis: "Odkrytie doľava", skresluje: false },
  { hodnota: "zoom", popis: "Oddialenie", skresluje: true },
  { hodnota: "zoom-in", popis: "Priblíženie", skresluje: true },
  { hodnota: "none", popis: "Bez prechodu", skresluje: false },
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
