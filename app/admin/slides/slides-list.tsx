"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { MenuData } from "@/lib/menu";
import SlideView from "@/app/slides/slide-view";
import { SABLONY, type Slide, type SlideTemplate } from "@/lib/slides/types";

/** popis šablóny podľa hodnoty — pre odznak na karte */
function popisSablony(t: SlideTemplate) {
  return SABLONY.find((s) => s.hodnota === t)?.popis ?? t;
}

export default function SlidesList({
  initial,
  menu,
}: {
  initial: Slide[];
  menu: MenuData | null;
}) {
  const [slides, setSlides] = useState(initial);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<SlideTemplate>("akcia");
  const [chyba, setChyba] = useState("");

  async function vytvor(e: React.FormEvent) {
    e.preventDefault();
    setChyba("");
    const r = await fetch("/api/admin/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, template }),
    });
    const d = await r.json();
    if (!r.ok) {
      setChyba(d.error ?? "Nepodarilo sa");
      return;
    }
    setSlides((s) => [...s, d as Slide]);
    setName("");
  }

  async function zmaz(s: Slide) {
    if (!confirm(`Naozaj zmazať „${s.name}"? Zo sledov ho treba odobrať zvlášť.`)) {
      return;
    }
    await fetch(`/api/admin/slides/${s.id}`, { method: "DELETE" });
    setSlides((zoznam) => zoznam.filter((x) => x.id !== s.id));
  }

  return (
    <>
      <header className="hlavicka">
        <h1>Slidy</h1>
        <p className="hlavicka__popis">VLASTNÉ OBRAZOVKY</p>
      </header>

      {slides.length === 0 && (
        <p className="ticho">Zatiaľ žiadny slide. Vytvor prvý nižšie.</p>
      )}

      {slides.map((s, i) => (
        <div className="karta" key={s.id} style={{ "--i": i } as CSSProperties}>
          <div className="hlava-karty">
            <h2>{s.name}</h2>
            <span className="odznak">{popisSablony(s.template)}</span>
          </div>

          <div className="nahlad nahlad--landscape">
            <SlideView
              slide={s}
              menu={menu}
              orientation="landscape"
              currency={menu?.currency ?? "Kč"}
            />
          </div>

          <div className="akcie">
            <Link className="tl tl--hlavne" href={"/admin/slides/" + s.id}>
              Upraviť
            </Link>
            <span className="akcie__medzera" />
            <button className="tl tl--ticho tl--male" onClick={() => zmaz(s)}>
              Zmazať
            </button>
          </div>
        </div>
      ))}

      <form
        className="karta"
        onSubmit={vytvor}
        style={{ "--i": slides.length } as CSSProperties}
      >
        <h2>Nový slide</h2>
        <div style={{ marginTop: "1rem" }}>
          <label className="pole">
            <span className="pole__popis">Názov</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. Víkendová akcia"
            />
          </label>
          <label className="pole">
            <span className="pole__popis">Šablóna</span>
            <span className="odznak">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as SlideTemplate)}
              >
                {SABLONY.map((s) => (
                  <option key={s.hodnota} value={s.hodnota}>
                    {s.popis}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
        {chyba && <p className="chyba">{chyba}</p>}
        <button className="tl tl--hlavne tl--siroke" disabled={!name.trim()}>
          Vytvoriť
        </button>
      </form>
    </>
  );
}
