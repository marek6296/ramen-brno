import path from "node:path";
import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

let instance: Store | null = null;

/**
 * Jediné miesto, kde sa rozhoduje, kam sa dáta ukladajú. Volajúci kód o tom
 * nevie — pracuje výhradne cez rozhranie `Store`.
 *
 * Keď sú nastavené obe premenné `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY`,
 * ide sa do Supabase. Inak sa beží nad lokálnym JSON súborom — lokálne
 * úložisko zostáva pre vývoj bez databázy, aby sa dalo spustiť a skúšať bez
 * pripojenia k Supabase.
 *
 * Kľúč sa číta cez `process.env` (nie `NEXT_PUBLIC_*`), takže sa do
 * prehliadača nikdy nedostane.
 */
export function getStore(): Store {
  if (!instance) {
    const url = process.env.SUPABASE_URL;
    const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;

    instance =
      url && kluc
        ? createSupabaseStore(url, kluc)
        : createLocalStore(
            process.env.TV_DATA_DIR ?? path.join(process.cwd(), ".data"),
          );
  }
  return instance;
}
