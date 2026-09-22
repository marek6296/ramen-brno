/**
 * Tvar média oddelene od `lib/media.ts` zámerne.
 *
 * `lib/media.ts` siaha na service role kľúč, takže je výhradne serverový a
 * nesmie sa objaviť v importoch klientskeho komponentu. Editor v adminovi ale
 * ten tvar potrebuje poznať — a typy sú tu samé, bez jediného riadku kódu,
 * takže z tohto súboru sa do prehliadača nemá čo dostať.
 */
export type MediaFile = {
  /** názov súboru v buckete — to, čím sa adresuje pri mazaní */
  path: string;
  /** verejná adresa, ktorú dostane televízor */
  url: string;
  /** názov na zobrazenie obsluhe (zhodný s `path`) */
  name: string;
  sizeB: number;
  kind: "image" | "video";
};
