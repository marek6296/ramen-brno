import { normalizeSlug } from "./storage/slug";

/**
 * Vlastné médiá (obrázky a videá) v Supabase Storage, bucket `tv-media`.
 *
 * Volá sa priamo cez `fetch`, rovnako ako `lib/storage/supabase.ts` — balík
 * `@supabase/supabase-js` by kvôli trom volaniam pribalil desiatky kilobajtov.
 *
 * SÚBOR JE VÝHRADNE SERVEROVÝ. Service role kľúč obchádza RLS, takže sa NIKDY
 * nesmie dostať do prehliadača — preto sa číta z `process.env` (nikdy nie
 * z `NEXT_PUBLIC_*`) a tento modul sa neimportuje z klientskych komponentov.
 * Klient sa k médiám dostane len cez `/api/admin/media`, ktorá beží na serveri.
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

const BUCKET = "tv-media";

/** true, keď sú nastavené obe premenné a dá sa s médiami pracovať */
export function mediaJeDostupne(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** prístupové údaje; volá sa až vo chvíli, keď sa naozaj ide na sieť */
function udaje(): { url: string; kluc: string } {
  const url = process.env.SUPABASE_URL;
  const kluc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kluc) {
    throw new Error(
      "Nahrávanie médií vyžaduje SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return { url: url.replace(/\/+$/, ""), kluc };
}

/**
 * Názov súboru od klienta → bezpečný názov v buckete.
 *
 * Diakritika a medzery idú preč (rovnako ako pri adresách obrazoviek), lebo
 * v URL sa zle prenášajú. Pred názov ide časová pečiatka, aby dve nahratia
 * toho istého „menu.jpg" neprepísali jedno druhé.
 */
export function ocistiNazovSuboru(raw: string, teraz = Date.now()): string {
  const bodka = raw.lastIndexOf(".");
  const zaklad = bodka > 0 ? raw.slice(0, bodka) : raw;
  const pripona = (bodka > 0 ? raw.slice(bodka + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);

  // Keď z názvu neostane nič použiteľné (napr. samé čínske znaky), radšej
  // neutrálne „subor" než prázdny názov, ktorý by Storage odmietlo.
  const meno = normalizeSlug(zaklad) || "subor";
  return pripona ? `${teraz}-${meno}.${pripona}` : `${teraz}-${meno}`;
}

/** `mp4` je jediné video, ktoré bucket pustí; všetko ostatné je obrázok */
function druh(nazov: string): MediaFile["kind"] {
  return nazov.toLowerCase().endsWith(".mp4") ? "video" : "image";
}

/**
 * Názvy súborov, ktoré sami vyrobíme, sú vždy z tejto množiny. Pri mazaní
 * príde názov z prehliadača, takže sa overuje — bez toho by sa dalo poslať
 * `../` a siahnuť mimo bucketu.
 */
export function jeBezpecnyNazov(nazov: string): boolean {
  return /^[a-z0-9][a-z0-9.\-]{0,119}$/.test(nazov) && !nazov.includes("..");
}

/** verejná adresa súboru v buckete */
function verejnaAdresa(url: string, nazov: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(nazov)}`;
}

async function odpovedAleboChyba(res: Response, co: string): Promise<string> {
  const telo = await res.text();
  if (!res.ok) {
    // Stav aj telo ideme do hlášky zámerne — bez nich sa chyba od Supabase
    // ladí veľmi ťažko, v logu by ostalo len „fetch failed".
    throw new Error(
      `Supabase Storage odmietol ${co} (HTTP ${res.status}): ${
        telo || "(prázdna odpoveď)"
      }`,
    );
  }
  return telo;
}

/** tvar položky tak, ako ju vracia Storage API */
type RiadokStorage = {
  name: string;
  id: string | null;
  metadata: { size?: number; mimetype?: string } | null;
};

export async function listMedia(): Promise<MediaFile[]> {
  const { url, kluc } = udaje();

  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    // Bez tohto by Next odpoveď cacheoval a práve nahratý súbor by sa
    // v zozname objavil až o hodnú chvíľu.
    cache: "no-store",
    headers: {
      apikey: kluc,
      Authorization: `Bearer ${kluc}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prefix: "",
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    }),
  });

  const telo = await odpovedAleboChyba(res, "výpis médií");
  const riadky = (telo ? JSON.parse(telo) : []) as RiadokStorage[];

  return riadky
    // Bucket vracia aj priečinky a technický záznam `.emptyFolderPlaceholder`;
    // ani jedno nemá `metadata`, takže sa dajú takto odfiltrovať.
    .filter((r) => r?.name && r.metadata)
    .map((r) => ({
      path: r.name,
      url: verejnaAdresa(url, r.name),
      name: r.name,
      sizeB: Number(r.metadata?.size ?? 0),
      kind: druh(r.name),
    }));
}

export async function uploadMedia(
  nazov: string,
  typ: string,
  data: ArrayBuffer,
): Promise<MediaFile> {
  const { url, kluc } = udaje();
  const cisty = ocistiNazovSuboru(nazov);

  const res = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(cisty)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: kluc,
        Authorization: `Bearer ${kluc}`,
        "content-type": typ,
      },
      body: data,
    },
  );

  await odpovedAleboChyba(res, `nahratie súboru ${cisty}`);

  return {
    path: cisty,
    url: verejnaAdresa(url, cisty),
    name: cisty,
    sizeB: data.byteLength,
    kind: druh(cisty),
  };
}

export async function deleteMedia(path: string): Promise<void> {
  const { url, kluc } = udaje();

  if (!jeBezpecnyNazov(path)) {
    throw new Error(`Neplatný názov súboru: ${path}`);
  }

  const res = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: { apikey: kluc, Authorization: `Bearer ${kluc}` },
    },
  );

  // Mazanie neexistujúceho súboru je z pohľadu obsluhy v poriadku — výsledok
  // je ten istý, súbor tam nie je.
  if (res.status === 404) return;
  await odpovedAleboChyba(res, `zmazanie súboru ${path}`);
}
