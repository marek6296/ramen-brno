import path from "node:path";
import { createLocalSlideStore } from "./local";
import { createSupabaseSlideStore } from "./supabase";
import type { SlideStore } from "./types";

let instance: SlideStore | null = null;

/**
 * Jediné miesto, kde sa rozhoduje, kam sa slidy ukladajú. Keď sú nastavené
 * prístupové údaje k Supabase, ide tam; inak do súboru — aby sa dalo vyvíjať
 * aj bez databázy.
 */
export function getSlideStore(): SlideStore {
  if (!instance) {
    const url = process.env.SUPABASE_URL;
    const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    instance =
      url && kluc
        ? createSupabaseSlideStore(url, kluc)
        : createLocalSlideStore(
            process.env.TV_DATA_DIR ?? path.join(process.cwd(), ".data"),
          );
  }
  return instance;
}
