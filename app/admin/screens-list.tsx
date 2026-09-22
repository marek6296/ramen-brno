"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Orientation, PlaylistItem, Screen } from "@/lib/storage/types";

/** slovenské počítanie položiek — „1 položka / 2 položky / 5 položiek" */
function pocetPoloziek(n: number) {
  if (n === 0) return "zatiaľ prázdne";
  if (n === 1) return "1 položka";
  if (n < 5) return `${n} položky`;
  return `${n} položiek`;
}

/**
 * Jedna dlaždica v páse sledu. Majiteľ tak na prvý pohľad vidí, čo na tej
 * televízii beží — bez toho, aby musel otvárať detail.
 */
function DlazdicaSledu({ polozka }: { polozka: PlaylistItem }) {
  if (polozka.kind === "menu") {
    return (
      <li className="pas__dlazdica pas__dlazdica--menu" title="Menu (živé z ChoiceQR)">
        MENU
      </li>
    );
  }
  if (polozka.kind === "video") {
    return (
      <li className="pas__dlazdica pas__dlazdica--video" title="Video">
        ▶
      </li>
    );
  }
  return (
    <li className="pas__dlazdica" title="Obrázok">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={polozka.mediaPath} alt="" />
    </li>
  );
}

export default function ScreensList({ initial }: { initial: Screen[] }) {
  const router = useRouter();
  const [screens, setScreens] = useState(initial);
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [chyba, setChyba] = useState("");
  /* Prepínanie orientácie beží pre každú obrazovku zvlášť, preto si stav
     držíme podľa id — inak by jedna prebiehajúca zmena zablokovala všetky. */
  const [prepinaSa, setPrepinaSa] = useState<Record<string, boolean>>({});
  const [chybaOrientacie, setChybaOrientacie] = useState<Record<string, string>>({});
  /* Mazanie je dvojkrokové: prvé ťuknutie sa spýta, druhé zmaže. Modálne
     `confirm()` sa na telefóne v zhone preklikne bez čítania. */
  const [pytaSaNaZmazanie, setPytaSaNaZmazanie] = useState<string | null>(null);
  const [skopirovane, setSkopirovane] = useState<string | null>(null);
  const casovace = useRef<ReturnType<typeof setTimeout>[]>([]);

  // po odchode zo stránky nesmie zostať bežať žiadny odpočet
  useEffect(() => {
    const zoznam = casovace.current;
    return () => zoznam.forEach(clearTimeout);
  }, []);

  function oneskorene(f: () => void, ms: number) {
    casovace.current.push(setTimeout(f, ms));
  }

  async function pridaj(e: React.FormEvent) {
    e.preventDefault();
    setChyba("");
    const r = await fetch("/api/admin/screens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, orientation }),
    });
    const data = await r.json();
    if (!r.ok) {
      setChyba(data.error ?? "Nepodarilo sa");
      return;
    }
    setScreens((s) => [...s, data as Screen]);
    setName("");
  }

  /* Orientáciu sa dá prepnúť priamo v zozname — klient ju mení najčastejšie
     a nechce kvôli tomu chodiť do detailu obrazovky. */
  async function zmenOrientaciu(s: Screen, nova: Orientation) {
    if (nova === s.orientation) return;
    setPrepinaSa((z) => ({ ...z, [s.id]: true }));
    setChybaOrientacie((z) => ({ ...z, [s.id]: "" }));
    try {
      const r = await fetch(`/api/admin/screens/${s.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orientation: nova }),
      });
      const data = await r.json();
      if (!r.ok) {
        setChybaOrientacie((z) => ({
          ...z,
          [s.id]: data.error ?? "Orientáciu sa nepodarilo zmeniť",
        }));
        return;
      }
      // Držíme sa pravdy zo servera, nie toho, čo sme poslali.
      setScreens((zoznam) =>
        zoznam.map((x) => (x.id === s.id ? (data as Screen) : x)),
      );
    } catch {
      setChybaOrientacie((z) => ({
        ...z,
        [s.id]: "Server neodpovedal — skús to znova",
      }));
    } finally {
      setPrepinaSa((z) => ({ ...z, [s.id]: false }));
    }
  }

  async function zmaz(s: Screen) {
    if (pytaSaNaZmazanie !== s.id) {
      setPytaSaNaZmazanie(s.id);
      // otázka sama zhasne, nech na karte nezostane visieť červené tlačidlo
      oneskorene(
        () => setPytaSaNaZmazanie((z) => (z === s.id ? null : z)),
        6000,
      );
      return;
    }
    setPytaSaNaZmazanie(null);
    await fetch(`/api/admin/screens/${s.id}`, { method: "DELETE" });
    setScreens((zoznam) => zoznam.filter((x) => x.id !== s.id));
  }

  function kopiruj(s: Screen) {
    navigator.clipboard?.writeText(`${location.origin}/tv/${s.slug}`);
    setSkopirovane(s.id);
    oneskorene(() => setSkopirovane((z) => (z === s.id ? null : z)), 2000);
  }

  async function odhlas() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className="hlavicka">
        <h1>
          Obrazovky
          <span className="hlavicka__popis">Ramen Brno · Václavská</span>
        </h1>
        <button className="tl tl--tmave tl--male" onClick={odhlas}>
          Odhlásiť
        </button>
      </header>

      {screens.map((s, index) => (
        <section
          className="karta"
          key={s.id}
          style={{ "--i": index } as React.CSSProperties}
        >
          <div className="hlava-karty">
            <h2>{s.name}</h2>
            <span className="odznak">
              <select
                aria-label={`Orientácia obrazovky ${s.name}`}
                value={s.orientation}
                disabled={prepinaSa[s.id] === true}
                onChange={(e) => zmenOrientaciu(s, e.target.value as Orientation)}
              >
                <option value="landscape">na šírku</option>
                <option value="portrait">na výšku</option>
              </select>
            </span>
          </div>

          {chybaOrientacie[s.id] && <p className="chyba">{chybaOrientacie[s.id]}</p>}

          {s.items.length === 0 ? (
            <p className="ticho" style={{ marginTop: "0.85rem" }}>
              Sled je zatiaľ prázdny — obrazovka nič neukáže.
            </p>
          ) : (
            <>
              <ul className="pas">
                {s.items.map((p) => (
                  <DlazdicaSledu key={p.id} polozka={p} />
                ))}
              </ul>
              <p className="ticho" style={{ marginTop: "0.5rem" }}>
                {pocetPoloziek(s.items.length)} v slede
              </p>
            </>
          )}

          <p className="adresa">
            <span className="adresa__text">/tv/{s.slug}</span>
            <button className="tl tl--ticho tl--male" onClick={() => kopiruj(s)}>
              {skopirovane === s.id ? "Skopírované" : "Kopírovať"}
            </button>
          </p>

          <div className="akcie">
            <Link className="tl tl--hlavne" href={`/admin/screens/${s.id}`}>
              Upraviť
            </Link>
            <span className="akcie__medzera" />
            <button
              className={
                pytaSaNaZmazanie === s.id
                  ? "tl tl--zle tl--zle-potvrd"
                  : "tl tl--zle"
              }
              onClick={() => zmaz(s)}
            >
              {pytaSaNaZmazanie === s.id ? "Naozaj zmazať?" : "Zmazať"}
            </button>
          </div>
        </section>
      ))}

      <form
        className="karta"
        onSubmit={pridaj}
        style={{ "--i": screens.length } as React.CSSProperties}
      >
        <h2>Pridať obrazovku</h2>
        <div style={{ marginTop: "1rem" }}>
          <label className="pole">
            <span className="pole__popis">Názov</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. TV pri bare"
            />
          </label>
          <label className="pole">
            <span className="pole__popis">Orientácia</span>
            <span className="odznak">
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
              >
                <option value="landscape">na šírku</option>
                <option value="portrait">na výšku</option>
              </select>
            </span>
          </label>
        </div>
        {chyba && <p className="chyba">{chyba}</p>}
        <button className="tl tl--hlavne tl--siroke" disabled={!name.trim()}>
          Pridať obrazovku
        </button>
      </form>
    </>
  );
}
