"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Orientation, Screen } from "@/lib/storage/types";

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
    if (!confirm(`Naozaj zmazať „${s.name}"? Sled položiek sa stratí.`)) return;
    await fetch(`/api/admin/screens/${s.id}`, { method: "DELETE" });
    setScreens((zoznam) => zoznam.filter((x) => x.id !== s.id));
  }

  async function odhlas() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className="admin__hlavicka">
        <h1>Obrazovky</h1>
        <button className="vedlajsie" onClick={odhlas}>
          Odhlásiť
        </button>
      </header>

      {screens.length === 0 && (
        <p className="ticho">Zatiaľ žiadna obrazovka. Pridaj prvú nižšie.</p>
      )}

      {screens.map((s) => (
        <div className="karta" key={s.id}>
          <div className="riadok riadok--medzi">
            <div>
              <strong>{s.name}</strong>{" "}
              <select
                aria-label={`Orientácia obrazovky ${s.name}`}
                value={s.orientation}
                disabled={prepinaSa[s.id] === true}
                onChange={(e) =>
                  zmenOrientaciu(s, e.target.value as Orientation)
                }
              >
                <option value="landscape">na šírku</option>
                <option value="portrait">na výšku</option>
              </select>{" "}
              <span className="ticho">
                {s.items.length === 0
                  ? "sled je prázdny"
                  : s.items.length === 1
                    ? "1 položka v slede"
                    : s.items.length < 5
                      ? `${s.items.length} položky v slede`
                      : `${s.items.length} položiek v slede`}
              </span>
              {chybaOrientacie[s.id] && (
                <p className="chyba">{chybaOrientacie[s.id]}</p>
              )}
            </div>
            <div className="riadok">
              <Link href={`/admin/screens/${s.id}`}>Nastaviť</Link>
              <button className="zle" onClick={() => zmaz(s)}>
                Zmazať
              </button>
            </div>
          </div>
          <p className="riadok">
            <span className="odkaz-tv">/tv/{s.slug}</span>
            <button
              className="vedlajsie"
              onClick={() =>
                navigator.clipboard?.writeText(`${location.origin}/tv/${s.slug}`)
              }
            >
              Kopírovať odkaz
            </button>
          </p>
        </div>
      ))}

      <form className="karta" onSubmit={pridaj}>
        <h2>Pridať obrazovku</h2>
        <label>
          Názov
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="napr. TV pri bare"
          />
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
        {chyba && <p className="chyba">{chyba}</p>}
        <button disabled={!name.trim()}>Pridať</button>
      </form>
    </>
  );
}
