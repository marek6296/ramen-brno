export type DemoSlide = {
  path: string;
  label: string;
  /** pre ktorú orientáciu je slide navrhnutý */
  orientation: "landscape" | "portrait";
};

/**
 * Ukážkové slidy sú súčasťou projektu, nie úložiska. Vďaka tomu sa dá celé
 * striedanie odskúšať na TV ešte predtým, než klient dodá Supabase.
 * V 2. etape k nim pribudne nahrávanie vlastných; tieto zostanú.
 */
export const DEMO_SLIDES: DemoSlide[] = [
  { path: "/demo/akce-dne.svg", label: "Akce dne", orientation: "landscape" },
  { path: "/demo/otvaracie-hodiny.svg", label: "Otevírací doba", orientation: "landscape" },
  { path: "/demo/na-vysku-uvitanie.svg", label: "Uvítanie (na výšku)", orientation: "portrait" },
];
