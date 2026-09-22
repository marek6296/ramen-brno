"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { DemoSlide } from "@/lib/slides";
// ZÁMERNE z `lib/media-typy`, nie z `lib/media`: ten druhý siaha na service
// role kľúč a je výhradne serverový, tu je len tvar dát.
import type { MediaFile } from "@/lib/media-typy";
import type {
  Orientation,
  PlaylistItem,
  Screen,
  Transition,
} from "@/lib/storage/types";

/** popisky prechodov pre obsluhu — poradie je aj poradím v ponuke */
const PRECHODY: { hodnota: Transition; popis: string; posuva: boolean }[] = [
  { hodnota: "fade", popis: "Prelínanie", posuva: false },
  { hodnota: "slide", popis: "Posun", posuva: true },
  { hodnota: "zoom", popis: "Priblíženie", posuva: true },
  { hodnota: "none", popis: "Bez prechodu", posuva: false },
];

/**
 * Menu si po zobrazení meria vlastné rozmery, aby sa rozhodlo, či zhustiť
 * sadzbu. Posun a priblíženie mu tie rozmery skreslia, takže ich prehrávač
 * pri menu ignoruje. Radšej ich teda vôbec neponúkame, než aby klient vyberal
 * niečo, čo sa potom potichu nepoužije.
 */
const prechodyPre = (kind: PlaylistItem["kind"]) =>
  kind === "menu" ? PRECHODY.filter((p) => !p.posuva) : PRECHODY;

/** veľkosť v MB na jedno desatinné miesto — bajty obsluhe nič nepovedia */
const vMB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export default function Editor({
  screen,
  slides,
  media,
  mediaDostupne,
}: {
  screen: Screen;
  slides: DemoSlide[];
  media: MediaFile[];
  mediaDostupne: boolean;
}) {
  const [name, setName] = useState(screen.name);
  const [orientation, setOrientation] = useState<Orientation>(screen.orientation);
  const [items, setItems] = useState<PlaylistItem[]>(screen.items);
  const [slug, setSlug] = useState(screen.slug);
  const [stav, setStav] = useState("");

  /* Zoznam médií prišiel zo servera, ale po nahratí alebo zmazaní si ho
     ťaháme znova z `/api/admin/media` — bez toho by sa nový súbor ukázal až
     po obnovení stránky. */
  const [mediaZoznam, setMediaZoznam] = useState<MediaFile[]>(media);
  const [nahravam, setNahravam] = useState(false);
  const [mediaStav, setMediaStav] = useState("");
  const vyberSuboru = useRef<HTMLInputElement>(null);

  function novyId() {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }

  function pridajMenu() {
    setItems((z) => [
      ...z,
      { id: novyId(), kind: "menu", mediaPath: "", durationS: 30, transition: "fade" },
    ]);
  }

  function pridajSlide(path: string) {
    setItems((z) => [
      ...z,
      { id: novyId(), kind: "image", mediaPath: path, durationS: 10, transition: "fade" },
    ]);
  }

  function pridajMedium(m: MediaFile) {
    setItems((z) => [
      ...z,
      {
        id: novyId(),
        kind: m.kind,
        // do sledu ide VEREJNÁ adresa, nie názov v buckete — televízor si
        // súbor ťahá priamo zo Supabase, bez nášho servera medzi tým
        mediaPath: m.url,
        // video nech stihne aspoň raz dobehnúť, obrázok sa prečíta rýchlejšie
        durationS: m.kind === "video" ? 15 : 10,
        transition: "fade",
      },
    ]);
  }

  async function obnovMedia() {
    const r = await fetch("/api/admin/media", { cache: "no-store" });
    if (!r.ok) return;
    setMediaZoznam((await r.json()) as MediaFile[]);
  }

  async function nahraj() {
    const subor = vyberSuboru.current?.files?.[0];
    if (!subor) {
      setMediaStav("Najprv vyber súbor");
      return;
    }

    setNahravam(true);
    setMediaStav(`Nahrávam ${subor.name}…`);

    const telo = new FormData();
    telo.append("file", subor);

    try {
      const r = await fetch("/api/admin/media", { method: "POST", body: telo });
      const data = (await r.json()) as MediaFile & { error?: string };
      if (!r.ok) {
        setMediaStav(data.error ?? "Súbor sa nepodarilo nahrať");
        return;
      }
      // Pole vyprázdnime, nech sa ten istý súbor nenahrá druhýkrát omylom.
      if (vyberSuboru.current) vyberSuboru.current.value = "";
      await obnovMedia();
      setMediaStav(`Nahraté: ${data.name}`);
    } catch {
      setMediaStav("Nahrávanie zlyhalo — skús to znova");
    } finally {
      setNahravam(false);
    }
  }

  async function zmazMedium(m: MediaFile) {
    if (!confirm(`Naozaj zmazať ${m.name}? Zo sledu treba položku odobrať zvlášť.`)) {
      return;
    }

    setMediaStav(`Mažem ${m.name}…`);
    try {
      const r = await fetch(
        `/api/admin/media?path=${encodeURIComponent(m.path)}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setMediaStav(data.error ?? "Súbor sa nepodarilo zmazať");
        return;
      }
      await obnovMedia();
      setMediaStav(`Zmazané: ${m.name}`);
    } catch {
      setMediaStav("Mazanie zlyhalo — skús to znova");
    }
  }

  function odober(id: string) {
    setItems((z) => z.filter((i) => i.id !== id));
  }

  function posun(i: number, o: number) {
    setItems((z) => {
      const ciel = i + o;
      if (ciel < 0 || ciel >= z.length) return z;
      const kopia = [...z];
      [kopia[i], kopia[ciel]] = [kopia[ciel], kopia[i]];
      return kopia;
    });
  }

  function trvanie(id: string, s: number) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, durationS: s } : i)));
  }

  function prechod(id: string, t: Transition) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, transition: t } : i)));
  }

  async function uloz() {
    setStav("Ukladám…");
    const r = await fetch(`/api/admin/screens/${screen.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, orientation, items }),
    });
    const data = await r.json();
    if (!r.ok) {
      setStav(data.error ?? "Nepodarilo sa uložiť");
      return;
    }
    setSlug((data as Screen).slug); // adresa sa nemení, len si držíme pravdu zo servera
    setStav("Uložené — TV sa prispôsobí do 15 sekúnd");
  }

  /* Rozdelenie sa riadi práve zvolenou orientáciou (stav `orientation`), nie
     tým, čo je uložené na serveri — klient si ju vie prepnúť pred uložením. */
  const sediace = slides.filter((s) => s.orientation === orientation);
  const nesediace = slides.filter((s) => s.orientation !== orientation);

  const menuNaVysku = orientation === "portrait" && items.some((i) => i.kind === "menu");

  /* Pri vlastnom médiu je `mediaPath` dlhá adresa do Supabase — v slede by
     zabrala celý riadok. Ukážeme radšej názov súboru. */
  const nazov = (i: PlaylistItem) =>
    i.kind === "menu"
      ? "Menu (živé z ChoiceQR)"
      : (slides.find((s) => s.path === i.mediaPath)?.label ??
        mediaZoznam.find((m) => m.url === i.mediaPath)?.name ??
        i.mediaPath);

  return (
    <>
      <header className="admin__hlavicka">
        <h1>{screen.name}</h1>
        <Link href="/admin">← Späť na zoznam</Link>
      </header>

      <div className="karta">
        <h2>Nastavenia</h2>
        <label>
          Názov
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Orientácia
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
          >
            <option value="landscape">na šírku</option>
            <option value="portrait">na výšku</option>
          </select>
        </label>
        <p className="ticho">
          Adresa pre TV (premenovaním sa nezmení, aby nastavená TV nezhasla):
        </p>
        <p className="odkaz-tv">/tv/{slug}</p>
      </div>

      <div className="karta">
        <h2>Sled na obrazovke</h2>
        {items.length === 0 && (
          <p className="ticho">Sled je prázdny — obrazovka zatiaľ nič neukáže.</p>
        )}
        {items.map((i, index) => (
          <div className="riadok riadok--medzi" key={i.id} style={{ marginBottom: "0.6rem" }}>
            <span>
              {index + 1}. {nazov(i)}
            </span>
            <span className="riadok">
              <input
                type="number"
                min={3}
                max={3600}
                value={i.durationS}
                onChange={(e) => trvanie(i.id, Number(e.target.value))}
                style={{ width: "5.5rem" }}
              />
              <span className="ticho">s</span>
              <select
                aria-label={`Prechod položky ${index + 1}`}
                value={i.transition}
                onChange={(e) => prechod(i.id, e.target.value as Transition)}
              >
                {prechodyPre(i.kind).map((p) => (
                  <option key={p.hodnota} value={p.hodnota}>
                    {p.popis}
                  </option>
                ))}
              </select>
              <button className="vedlajsie" onClick={() => posun(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button
                className="vedlajsie"
                onClick={() => posun(index, 1)}
                disabled={index === items.length - 1}
              >
                ↓
              </button>
              <button className="zle" onClick={() => odober(i.id)}>
                ×
              </button>
            </span>
          </div>
        ))}
        {menuNaVysku && (
          <p className="ticho" style={{ marginTop: "0.8rem" }}>
            Pozor: menu na výšku príde až v 3. etape. Zatiaľ sa aj na obrazovke
            na výšku vykreslí rozloženie na šírku.
          </p>
        )}
      </div>

      <div className="karta">
        <h2>Pridať do sledu</h2>
        <div className="riadok">
          <button className="vedlajsie" onClick={pridajMenu}>
            + Menu
          </button>
          {sediace.map((s) => (
            <button key={s.path} className="vedlajsie" onClick={() => pridajSlide(s.path)}>
              + {s.label}
            </button>
          ))}
        </div>

        {nesediace.length > 0 && (
          <>
            <h3 style={{ marginTop: "1.2rem" }}>Nesedia s orientáciou obrazovky</h3>
            <p className="ticho">
              Na tejto obrazovke po stranách zostanú prázdne pásy. Pridať sa
              dajú, ak to tak chceš.
            </p>
            <div className="riadok">
              {nesediace.map((s) => (
                <button
                  key={s.path}
                  className="vedlajsie"
                  onClick={() => pridajSlide(s.path)}
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <h3 style={{ marginTop: "1.2rem" }}>Vlastné obrázky a videá</h3>

        {!mediaDostupne ? (
          <p className="ticho">
            Nahrávanie vlastných obrázkov a videí vyžaduje pripojenú databázu.
          </p>
        ) : (
          <>
            <p className="ticho">
              Povolené sú JPEG, PNG, WebP, SVG a MP4, najviac 50 MB na súbor.
              Videá sa prehrávajú bez zvuku — televízory ani prehliadače
              automatické prehratie so zvukom nedovolia.
            </p>

            <div className="riadok" style={{ marginTop: "0.8rem" }}>
              <input
                ref={vyberSuboru}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4"
                disabled={nahravam}
                aria-label="Súbor na nahratie"
              />
              <button onClick={nahraj} disabled={nahravam}>
                {nahravam ? "Nahrávam…" : "Nahrať"}
              </button>
              {mediaStav && <span className="ticho">{mediaStav}</span>}
            </div>

            {mediaZoznam.length === 0 ? (
              <p className="ticho" style={{ marginTop: "0.8rem" }}>
                Zatiaľ nie je nahraté žiadne vlastné médium.
              </p>
            ) : (
              <ul className="media">
                {mediaZoznam.map((m) => (
                  <li className="media__polozka" key={m.path}>
                    {m.kind === "image" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="media__nahlad" src={m.url} alt="" />
                    ) : (
                      <span className="media__nahlad media__nahlad--video">▶</span>
                    )}
                    <span className="media__nazov">
                      {m.name}
                      <span className="ticho"> · {vMB(m.sizeB)}</span>
                    </span>
                    <span className="riadok">
                      <button className="vedlajsie" onClick={() => pridajMedium(m)}>
                        + Pridať do sledu
                      </button>
                      <button className="zle" onClick={() => zmazMedium(m)}>
                        Zmazať
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="riadok">
        <button onClick={uloz}>Uložiť</button>
        {stav && <span className="ticho">{stav}</span>}
      </div>
    </>
  );
}
