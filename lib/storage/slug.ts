/**
 * Názov obrazovky od klienta -> bezpečná časť adresy.
 * Diakritika ide preč, lebo `/tv/tv-pri-báre` sa zle prepisuje na TV
 * aj zle posiela v správe.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
