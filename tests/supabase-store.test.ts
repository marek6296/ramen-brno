import { describe, it } from "vitest";
import { createSupabaseStore } from "@/lib/storage/supabase";
import { skontrolujStore } from "./store-kontrakt";

/**
 * Tá istá sada, ktorá meria lokálne úložisko, pustená nad živým Supabase.
 * Zmysel je jediný: keď sa obe implementácie nesprávajú rovnako, chceme to
 * vedieť tu, a nie až z televízora v prevádzke.
 *
 * Beží len vtedy, keď sú v prostredí prístupové údaje — na inom stroji alebo
 * v CI sa preskočí, namiesto aby padol.
 *
 * Testy pracujú so SKUTOČNOU databázou, preto po sebe upratujú a dotýkajú sa
 * výhradne riadkov, ktoré samy vytvorili.
 */
const url = process.env.SUPABASE_URL;
const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !kluc) {
  describe("kontrakt úložiska (Supabase)", () => {
    it.skip("preskočené — nie sú nastavené SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
} else {
  const store = createSupabaseStore(url, kluc);

  skontrolujStore("Supabase", async () => {
    // Prázdne úložisko pred každým testom: zmažeme, čo tam po nás ostalo.
    await vymazVsetko();
    return { store, uprac: vymazVsetko };
  });

  async function vymazVsetko() {
    for (const s of await store.listScreens()) {
      await store.deleteScreen(s.id);
    }
  }
}
