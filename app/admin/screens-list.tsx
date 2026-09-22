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
              <span className="ticho">
                {s.orientation === "portrait" ? "na výšku" : "na šírku"} ·{" "}
                {s.items.length} položiek v slede
              </span>
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
