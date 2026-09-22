import {
  platnaAnimacia,
  SlideNotFoundError,
  prazdneFields,
  type NewSlide,
  type Slide,
  type SlidePatch,
  type SlideStore,
  type SlideTemplate,
} from "./types";

type Riadok = {
  id: string;
  name: string;
  template: SlideTemplate;
  variant: Slide["variant"];
  animation: Slide["animation"];
  fields: Slide["fields"] | null;
  updated_at: number;
};

/** V databáze `updated_at`, v TypeScripte `updatedAt`. Prázdne polia dopĺňame. */
function naSlide(r: Riadok): Slide {
  return {
    id: r.id,
    name: r.name,
    template: r.template,
    variant: r.variant,
    animation: platnaAnimacia(r.animation),
    fields:
      r.fields && Object.keys(r.fields).length > 0
        ? r.fields
        : prazdneFields(r.template),
    updatedAt: Number(r.updated_at),
  };
}

export function createSupabaseSlideStore(url: string, serviceKey: string): SlideStore {
  const zaklad = `${url}/rest/v1/slides`;
  const hlavicky = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  async function ziadost(cesta: string, init?: RequestInit): Promise<Riadok[]> {
    const r = await fetch(zaklad + cesta, {
      ...init,
      headers: { ...hlavicky, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const telo = await r.text();
    if (!r.ok) {
      throw new Error(`Supabase slides ${r.status}: ${telo.slice(0, 200)}`);
    }
    return telo ? (JSON.parse(telo) as Riadok[]) : [];
  }

  return {
    async listSlides() {
      return (await ziadost("?select=*&order=name.asc")).map(naSlide);
    },

    async getSlide(id) {
      // Nezmyselné id (nie uuid) vráti Postgres ako chybu tvaru — pre volajúceho
      // je to ale proste „neexistuje", nie porucha.
      try {
        const r = await ziadost(`?id=eq.${encodeURIComponent(id)}&select=*`);
        return r[0] ? naSlide(r[0]) : null;
      } catch {
        return null;
      }
    },

    async getSlidesByIds(ids) {
      if (ids.length === 0) return [];
      const zoznam = ids.map((i) => `"${i}"`).join(",");
      let riadky: Riadok[] = [];
      try {
        riadky = await ziadost(`?id=in.(${zoznam})&select=*`);
      } catch {
        return [];
      }
      const podla = new Map(riadky.map((r) => [r.id, naSlide(r)]));
      // Poradie drží zoznam, ktorý prišiel — nie databáza.
      return ids.map((id) => podla.get(id)).filter((s): s is Slide => !!s);
    },

    async createSlide(input: NewSlide) {
      const r = await ziadost("", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name: input.name,
          template: input.template,
          variant: "papier",
          animation: "ziadna",
          fields: prazdneFields(input.template),
        }),
      });
      return naSlide(r[0]);
    },

    async updateSlide(id, patch: SlidePatch) {
      // `updatedAt` neposielame, dvíha ho databázový trigger.
      const telo = Object.keys(patch).length > 0 ? patch : { id };
      let r: Riadok[];
      try {
        r = await ziadost(`?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(telo),
        });
      } catch {
        throw new SlideNotFoundError();
      }
      if (!r[0]) throw new SlideNotFoundError();
      return naSlide(r[0]);
    },

    async deleteSlide(id) {
      await ziadost(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
