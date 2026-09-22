import { describe, it } from "vitest";
import { createSupabaseStore } from "@/lib/storage/supabase";
import { skontrolujStore } from "./store-kontrakt";

/**
 * Tá istá sada, ktorá meria lokálne úložisko, pustená nad živým Supabase.
 * Zmysel je jediný: keď sa obe implementácie nesprávajú rovnako, chceme to
 * vedieť tu, a nie až z televízora v prevádzke.
 *
 * POZOR, a preto tá poistka nižšie: sada potrebuje PRÁZDNE úložisko, takže
 * pred každým testom **zmaže všetky obrazovky v tabuľke**. Na databáze, kde
 * niečo naozaj beží, to znamená stratu dát. Preto sa nespustí len tak —
 * musí byť výslovne zapnutá premennou `SUPABASE_TEST_WIPE=1`, ktorá patrí
 * výhradne do testovacieho projektu.
 *
 * Bez nej sa sada preskočí a `npm test` klientovu databázu nemá ako zmazať,
 * aj keby bola v prostredí pripojená.
 */
const url = process.env.SUPABASE_URL;
const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const smieMazat = process.env.SUPABASE_TEST_WIPE === "1";

if (!url || !kluc) {
  describe("kontrakt úložiska (Supabase)", () => {
    it.skip("preskočené — nie sú nastavené SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
} else if (!smieMazat) {
  describe("kontrakt úložiska (Supabase)", () => {
    it.skip(
      "preskočené — sada maže VŠETKY obrazovky, zapni ju len na testovacom " +
        "projekte cez SUPABASE_TEST_WIPE=1",
      () => {},
    );
  });
} else {
  const store = createSupabaseStore(url, kluc);

  skontrolujStore("Supabase", async () => {
    await vymazVsetko();
    return { store, uprac: vymazVsetko };
  });

  async function vymazVsetko() {
    for (const s of await store.listScreens()) {
      await store.deleteScreen(s.id);
    }
  }
}
