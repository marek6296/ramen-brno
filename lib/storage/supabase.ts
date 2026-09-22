import { DuplicateSlugError, NotFoundError } from "./types";
import type {
  NewScreen,
  Orientation,
  PlaylistItem,
  Screen,
  ScreenPatch,
  Store,
  Transition,
} from "./types";

/**
 * Úložisko nad Supabase, volané priamo cez PostgREST obyčajným `fetch`.
 *
 * Zámerne bez balíka `@supabase/supabase-js`: sú to štyri druhy volaní nad
 * jednou tabuľkou, klient by pribalil desiatky kilobajtov navyše.
 *
 * SÚBOR JE VÝHRADNE SERVEROVÝ. `serviceKey` obchádza RLS, takže sa NIKDY
 * nesmie dostať do prehliadača — preto sa číta z `process.env` (a nikdy
 * nie z `NEXT_PUBLIC_*`) a tento modul sa neimportuje z klientskych
 * komponentov.
 */

const PRECHODY: Transition[] = ["fade", "slide", "zoom", "none"];

/** tvar riadka tak, ako príde z databázy — `updated_at` v snake_case */
type Riadok = {
  id: string;
  slug: string;
  name: string;
  orientation: Orientation;
  items: PlaylistItem[] | null;
  updated_at: number | string;
};

/**
 * Rovnako ako v lokálnom úložisku: položky uložené pred zavedením prechodov
 * pole `transition` nemajú. Keby sa nedoplnilo, prehrávač by položke nalepil
 * triedu `polozka--prechod-undefined` a nenastúpila by. `"fade"` je pôvodné
 * správanie.
 *
 * To isté platí pre `repeats` (počet prehratí videa): staré položky ho nemajú
 * a prehrávač by čakal na `undefined` prehratí, teda navždy. `1` je pôvodné
 * správanie — klip sa prehrá raz a ide sa ďalej.
 */
function dopln(it: PlaylistItem): PlaylistItem {
  const prechodSedi = PRECHODY.includes(it?.transition);
  const opakovaniaSedia = Number.isInteger(it?.repeats) && it.repeats >= 1;
  if (prechodSedi && opakovaniaSedia) return it;
  return {
    ...it,
    transition: prechodSedi ? it.transition : "fade",
    repeats: opakovaniaSedia ? it.repeats : 1,
  };
}

/** riadok z databázy → `Screen`; tu sa `updated_at` mení na `updatedAt` */
function naScreen(r: Riadok): Screen {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    orientation: r.orientation,
    items: (r.items ?? []).map(dopln),
    updatedAt: Number(r.updated_at),
  };
}

/** chyba z PostgRESTu aj s kódom, aby sa dala preložiť na našu triedu */
class ChybaPostgrest extends Error {
  readonly kod?: string;
  readonly stav: number;

  constructor(stav: number, kod: string | undefined, telo: string) {
    super(
      `Supabase odmietol požiadavku (HTTP ${stav}${
        kod ? `, kód ${kod}` : ""
      }): ${telo}`,
    );
    this.name = "ChybaPostgrest";
    this.stav = stav;
    this.kod = kod;
  }
}

/** porušenie unique indexu — u nás vždy `screens_slug_key` */
const DUPLICITA = "23505";
/** neplatný zápis hodnoty, napr. nezmyselný text na mieste uuid */
const ZLY_TVAR = "22P02";

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const base = `${url.replace(/\/+$/, "")}/rest/v1/screens`;

  async function volaj(
    dotaz: string,
    init: RequestInit = {},
  ): Promise<Riadok[]> {
    const res = await fetch(`${base}${dotaz}`, {
      ...init,
      // Bez tohto by Next odpovede cacheoval a televízor by ukazoval staré
      // dáta ešte dlho po tom, čo ich admin zmenil.
      cache: "no-store",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const telo = await res.text();

    if (!res.ok) {
      let kod: string | undefined;
      try {
        kod = (JSON.parse(telo) as { code?: string })?.code;
      } catch {
        // telo nemusí byť JSON (proxy, výpadok) — vtedy ostane bez kódu
      }
      // Stav aj telo ideme do hlášky zámerne: bez nich sa chyba od Supabase
      // ladí veľmi ťažko, v logu by ostalo len „fetch failed".
      throw new ChybaPostgrest(res.status, kod, telo || "(prázdna odpoveď)");
    }

    if (!telo) return [];
    return JSON.parse(telo) as Riadok[];
  }

  /**
   * `id` je v databáze uuid. Keď príde z adresy nezmysel, Postgres to odmietne
   * ako zlý tvar — z pohľadu volajúceho ale taká obrazovka jednoducho
   * neexistuje. Bez tohto prekladu by admin na nezmyselnú adresu vracal 500
   * namiesto 404.
   */
  function jeNeznameId(e: unknown): boolean {
    return e instanceof ChybaPostgrest && e.kod === ZLY_TVAR;
  }

  function jeDuplicita(e: unknown): boolean {
    return e instanceof ChybaPostgrest && e.kod === DUPLICITA;
  }

  return {
    async listScreens() {
      const riadky = await volaj("?select=*&order=name.asc");
      return riadky.map(naScreen);
    },

    async getScreen(id) {
      try {
        const riadky = await volaj(
          `?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
        );
        return riadky[0] ? naScreen(riadky[0]) : null;
      } catch (e) {
        if (jeNeznameId(e)) return null;
        throw e;
      }
    },

    async getScreenBySlug(slug) {
      const riadky = await volaj(
        `?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      );
      return riadky[0] ? naScreen(riadky[0]) : null;
    },

    async createScreen(input: NewScreen) {
      let riadky: Riadok[];
      try {
        riadky = await volaj("?select=*", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          // `id`, `items` a `updated_at` dopĺňa databáza svojimi defaultmi
          body: JSON.stringify({
            name: input.name,
            slug: input.slug,
            orientation: input.orientation,
          }),
        });
      } catch (e) {
        if (jeDuplicita(e)) throw new DuplicateSlugError(input.slug);
        throw e;
      }

      if (!riadky[0]) {
        throw new Error("Supabase nevrátil založenú obrazovku");
      }
      return naScreen(riadky[0]);
    },

    async updateScreen(id, patch: ScreenPatch) {
      const telo: Record<string, unknown> = {};
      if (patch.name !== undefined) telo.name = patch.name;
      if (patch.slug !== undefined) telo.slug = patch.slug;
      if (patch.orientation !== undefined) telo.orientation = patch.orientation;
      if (patch.items !== undefined) telo.items = patch.items;
      // `updatedAt` sa ZÁMERNE neposiela — o `updated_at` sa stará trigger
      // `screens_bump_updated_at`, ktorý ho pri každom UPDATE zvýši.

      // Prázdny patch (admin poslal len neplatné polia) musí aj tak posunúť
      // `updated_at`, rovnako ako to robí lokálne úložisko. Prepis `id` na tú
      // istú hodnotu je zápis ako každý iný, takže trigger prebehne — a
      // PostgREST neodmietne požiadavku s prázdnym telom.
      if (Object.keys(telo).length === 0) telo.id = id;

      let riadky: Riadok[];
      try {
        riadky = await volaj(`?select=*&id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(telo),
        });
      } catch (e) {
        if (jeNeznameId(e)) throw new NotFoundError();
        if (jeDuplicita(e)) throw new DuplicateSlugError(patch.slug ?? "");
        throw e;
      }

      // PATCH nad neexistujúcim riadkom nie je chyba — vráti prázdny zoznam.
      if (!riadky[0]) throw new NotFoundError();
      return naScreen(riadky[0]);
    },

    async deleteScreen(id) {
      try {
        await volaj(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      } catch (e) {
        // Mazanie neexistujúcej obrazovky je aj lokálne ticho v poriadku.
        if (jeNeznameId(e)) return;
        throw e;
      }
    },
  };
}
