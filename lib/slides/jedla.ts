import type { Dish, MenuData } from "@/lib/menu";
import { stojiNaJedlach, type Slide } from "./types";

/**
 * Jedlá zo slidu vyhľadá v živých dátach z ChoiceQR. Poradie drží podľa
 * `dishIds`, nie podľa menu — klient si ho v slide určuje sám.
 *
 * Jedlo, ktoré sa nenájde, sa TICHO vynechá. Klient mení menu často a slide
 * sa nesmie kvôli tomu ukázať rozbitý.
 */
export function najdiJedla(menu: MenuData | null, ids: string[]): Dish[] {
  if (!menu) return [];
  const vsetky = new Map<string, Dish>();
  for (const g of menu.left) for (const d of g.dishes) vsetky.set(d.id, d);
  for (const g of menu.right) for (const d of g.dishes) vsetky.set(d.id, d);
  for (const d of menu.main?.dishes ?? []) vsetky.set(d.id, d);
  return ids.map((id) => vsetky.get(id)).filter((d): d is Dish => !!d);
}

/**
 * Slide, ktorý stojí na jedlách a ani jedno z nich už v menu nie je, nemá čo
 * ukázať. Televízor ho preskočí — lepšie než prázdny rámec cez celú stenu.
 *
 * Šablóny, ktoré na jedlách nestoja (Uvítanie, Oznámenie), nie sú prázdne
 * nikdy. Ktoré na nich stoja, hovorí `stojiNaJedlach` — na jedinom mieste.
 */
export function jeSlidePrazdny(slide: Slide, menu: MenuData | null): boolean {
  if (!stojiNaJedlach(slide.template)) return false;
  const f = slide.fields as { dishIds: string[] };
  if (f.dishIds.length === 0) return false;
  return najdiJedla(menu, f.dishIds).length === 0;
}
