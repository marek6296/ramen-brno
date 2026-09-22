"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SABLONY, type Slide } from "@/lib/slides/types";
import type {
  Orientation,
  PlaylistItem,
  Rotation,
  Screen,
} from "@/lib/storage/types";

/** popisky otočenia pre obsluhu — poradie je aj poradím v ponuke */
const OTOCENIA: { hodnota: Rotation; popis: string }[] = [
  { hodnota: "right", popis: "doprava" },
  { hodnota: "left", popis: "doľava" },
  { hodnota: "none", popis: "neotáčať (TV si to otočí sama)" },
];

/**
 * Otáča sa len doska na výšku — tá na šírku sedí v okne televízora tak, ako
 * je. Pri prepnutí na výšku preto rovno ponúkneme otočenie doprava (tak visia
 * obe televízie klienta), pri prepnutí na šírku sa otáčanie vypína.
 */
const otocenieK = (o: Orientation): Rotation =>
  o === "portrait" ? "right" : "none";

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
function DlazdicaSledu({
  polozka,
  slide,
}: {
  polozka: PlaylistItem;
  slide?: Slide;
}) {
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
  if (polozka.kind === "slide") {
    // Slide nemá obrázok, ktorý by sa dal ukázať. Bez tejto vetvy tu visela
    // prázdna dlaždica a nebolo poznať, čo na tej TV vlastne je.
    return (
      <li
        className="pas__dlazdica pas__dlazdica--slide"
        title={slide ? `Slide: ${slide.name}` : "Zmazaný slide"}
      >
        {slide ? "SLIDE" : "?"}
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

/** Čitateľný názov položky do zhrnutia pod pásikom. */
function popisPolozky(p: PlaylistItem, slidy: Map<string, Slide>): string {
  if (p.kind === "menu") return "Menu";
  if (p.kind === "video") return "Video";
  if (p.kind === "slide") {
    const s = slidy.get(p.slideId);
    if (!s) return "zmazaný slide";
    const sablona = SABLONY.find((x) => x.hodnota === s.template)?.popis ?? s.template;
    return `${s.name} (${sablona})`;
  }
  const kusy = p.mediaPath.split("/");
  return decodeURIComponent(kusy[kusy.length - 1] || "obrázok");
}

export default function ScreensList({
  initial,
  slidy,
}: {
  initial: Screen[];
  slidy: Slide[];
}) {
  const router = useRouter();
  const [screens, setScreens] = useState(initial);
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [rotation, setRotation] = useState<Rotation>("none");
  const [chyba, setChyba] = useState("");
  const podlaId = useMemo(() => new Map(slidy.map((s) => [s.id, s])), [slidy]);
  /* Prepínanie orientácie beží pre každú obrazovku zvlášť, preto si stav
     držíme podľa id — inak by jedna prebiehajúca zmena zablokovala všetky. */
  const [prepinaSa, setPrepinaSa] = useState<Record<string, boolean>>({});
  const [chybaZmeny, setChybaZmeny] = useState<Record<string, string>>({});
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
      body: JSON.stringify({ name, orientation, rotation }),
    });
    const data = await r.json();
    if (!r.ok) {
      setChyba(data.error ?? "Nepodarilo sa");
      return;
    }
    setScreens((s) => [...s, data as Screen]);
    setName("");
  }

  /* Orientáciu aj otočenie sa dá prepnúť priamo v zozname — klient ich mení
     najčastejšie a nechce kvôli tomu chodiť do detailu obrazovky. */
  async function uprav(
    s: Screen,
    zmena: { orientation?: Orientation; rotation?: Rotation },
  ) {
    setPrepinaSa((z) => ({ ...z, [s.id]: true }));
    setChybaZmeny((z) => ({ ...z, [s.id]: "" }));
    try {
      const r = await fetch(`/api/admin/screens/${s.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(zmena),
      });
      const data = await r.json();
      if (!r.ok) {
        setChybaZmeny((z) => ({
          ...z,
          [s.id]: data.error ?? "Zmenu sa nepodarilo uložiť",
        }));
        return;
      }
      // Držíme sa pravdy zo servera, nie toho, čo sme poslali.
      setScreens((zoznam) =>
        zoznam.map((x) => (x.id === s.id ? (data as Screen) : x)),
      );
    } catch {
      setChybaZmeny((z) => ({
        ...z,
        [s.id]: "Server neodpovedal — skús to znova",
      }));
    } finally {
      setPrepinaSa((z) => ({ ...z, [s.id]: false }));
    }
  }

  /* Orientácia a otočenie chodia jedným zápisom: doska na šírku sa neotáča
     nikdy, takže by inak medzi dvoma zápismi ostala obrazovka na chvíľu
     otočená na šírku — teda bokom. */
  function zmenOrientaciu(s: Screen, nova: Orientation) {
    if (nova === s.orientation) return;
    return uprav(s, { orientation: nova, rotation: otocenieK(nova) });
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
            {/* Otočenie má zmysel len na výšku — doska na šírku sedí v okne
                televízora tak, ako je. */}
            {s.orientation === "portrait" && (
              <span className="odznak">
                <select
                  aria-label={`Otočenie obrazu obrazovky ${s.name}`}
                  value={s.rotation}
                  disabled={prepinaSa[s.id] === true}
                  onChange={(e) =>
                    uprav(s, { rotation: e.target.value as Rotation })
                  }
                >
                  {OTOCENIA.map((o) => (
                    <option key={o.hodnota} value={o.hodnota}>
                      {o.popis}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </div>

          {chybaZmeny[s.id] && <p className="chyba">{chybaZmeny[s.id]}</p>}

          {s.items.length === 0 ? (
            <p className="ticho" style={{ marginTop: "0.85rem" }}>
              Sled je zatiaľ prázdny — obrazovka nič neukáže.
            </p>
          ) : (
            <>
              <ul className="pas">
                {s.items.map((p) => (
                  <DlazdicaSledu
                    key={p.id}
                    polozka={p}
                    slide={p.kind === "slide" ? podlaId.get(p.slideId) : undefined}
                  />
                ))}
              </ul>
              <p className="ticho" style={{ marginTop: "0.5rem" }}>
                {pocetPoloziek(s.items.length)} v slede
              </p>
              {/* Ikonky samy o sebe nepovedia, čo na televízore beží.
                  Vypísané po poradí to povedia. */}
              <p className="sled-zhrnutie">
                {s.items.map((p) => popisPolozky(p, podlaId)).join(" · ")}
              </p>
            </>
          )}

          <p className="adresa">
            <span className="adresa__text">/tv/{s.slug}</span>
            {/* Nové okno zámerne: admin ostane otvorený tam, kde bol. */}
            <a
              className="tl tl--ticho tl--male"
              href={`/tv/${s.slug}`}
              target="_blank"
              rel="noopener"
            >
              Otvoriť
            </a>
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
                onChange={(e) => {
                  const nova = e.target.value as Orientation;
                  setOrientation(nova);
                  setRotation(otocenieK(nova));
                }}
              >
                <option value="landscape">na šírku</option>
                <option value="portrait">na výšku</option>
              </select>
            </span>
          </label>
          {orientation === "portrait" && (
            <label className="pole">
              <span className="pole__popis">Otočenie obrazu</span>
              <span className="odznak">
                <select
                  value={rotation}
                  onChange={(e) => setRotation(e.target.value as Rotation)}
                >
                  {OTOCENIA.map((o) => (
                    <option key={o.hodnota} value={o.hodnota}>
                      {o.popis}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </div>
        {chyba && <p className="chyba">{chyba}</p>}
        <button className="tl tl--hlavne tl--siroke" disabled={!name.trim()}>
          Pridať obrazovku
        </button>
      </form>
    </>
  );
}
