"use client";

import { useState } from "react";
import Link from "next/link";
import type { DemoSlide } from "@/lib/slides";
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

export default function Editor({
  screen,
  slides,
}: {
  screen: Screen;
  slides: DemoSlide[];
}) {
  const [name, setName] = useState(screen.name);
  const [orientation, setOrientation] = useState<Orientation>(screen.orientation);
  const [items, setItems] = useState<PlaylistItem[]>(screen.items);
  const [slug, setSlug] = useState(screen.slug);
  const [stav, setStav] = useState("");

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

  const nazov = (i: PlaylistItem) =>
    i.kind === "menu"
      ? "Menu (živé z ChoiceQR)"
      : (slides.find((s) => s.path === i.mediaPath)?.label ?? i.mediaPath);

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

        <p className="ticho" style={{ marginTop: "0.8rem" }}>
          Nahrávanie vlastných obrázkov pribudne po pripojení databázy.
        </p>
      </div>

      <div className="riadok">
        <button onClick={uloz}>Uložiť</button>
        {stav && <span className="ticho">{stav}</span>}
      </div>
    </>
  );
}
