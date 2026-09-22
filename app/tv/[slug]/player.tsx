"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/app/board";
import type { MenuData } from "@/lib/menu";
import type { Screen } from "@/lib/storage/types";
import "./player.css";

/** ako často sa TV pýta, či klient niečo nezmenil */
const DOPYT_MS = 15_000;
/** ako často sa obnovuje menu — rovnako ako na produkčnej TV */
const MENU_MS = 60_000;

export default function Player({ initial }: { initial: Screen }) {
  const [screen, setScreen] = useState(initial);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [index, setIndex] = useState(0);
  const [bezKurzora, setBezKurzora] = useState(false);
  const casovac = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = screen.items;
  const maMenu = items.some((i) => i.kind === "menu");

  /* Nastavenia: pýtame sa pravidelne, nech sa zmena z adminu prejaví sama
     a nikto nemusí ísť k TV reštartovať prehliadač. */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/screens/${screen.slug}`, { cache: "no-store" });
        if (!r.ok) return;
        const fresh = (await r.json()) as Screen;
        setScreen((stary) => (fresh.updatedAt !== stary.updatedAt ? fresh : stary));
      } catch {
        /* výpadok siete nesmie zhodiť obrazovku — skúsime o 15 s znova */
      }
    }, DOPYT_MS);
    return () => clearInterval(id);
  }, [screen.slug]);

  /* Menu ťaháme cez existujúci proxy, ten istý, čo používa produkčná TV. */
  useEffect(() => {
    if (!maMenu) return;
    let zive = true;
    const nacitaj = async () => {
      try {
        const r = await fetch("/api/menu");
        if (!r.ok) return;
        const d = (await r.json()) as MenuData;
        if (zive) setMenu(d);
      } catch {
        /* keď ChoiceQR chvíľu nič nepošle, necháme na obrazovke to staré */
      }
    };
    nacitaj();
    const id = setInterval(nacitaj, MENU_MS);
    return () => {
      zive = false;
      clearInterval(id);
    };
  }, [maMenu]);

  /* Striedanie položiek. Beží podľa trvania práve zobrazenej položky. */
  const podpis = useMemo(
    () => items.map((i) => `${i.id}:${i.durationS}`).join(","),
    [items],
  );

  useEffect(() => {
    setIndex(0);
  }, [podpis]);

  useEffect(() => {
    if (items.length < 2) return;
    const trvanie = Math.max(3, items[index]?.durationS ?? 10) * 1000;
    casovac.current = setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      trvanie,
    );
    return () => {
      if (casovac.current) clearTimeout(casovac.current);
    };
  }, [index, items, podpis]);

  /* Kurzor zmizne, keď sa myš nehýbe — na TV nemá čo robiť. */
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const posun = () => {
      setBezKurzora(false);
      clearTimeout(id);
      id = setTimeout(() => setBezKurzora(true), 4000);
    };
    posun();
    window.addEventListener("mousemove", posun);
    return () => {
      window.removeEventListener("mousemove", posun);
      clearTimeout(id);
    };
  }, []);

  async function celuObrazovku() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* niektoré TV prehliadače to nedovolia — tlačidlo potom len nič neurobí */
    }
  }

  return (
    <div className={`prehravac${bezKurzora ? " prehravac--bez-kurzora" : ""}`}>
      {items.length === 0 && (
        <p className="prazdne">
          Obrazovka „{screen.name}" zatiaľ nemá nastavený žiadny obsah.
        </p>
      )}

      {items.map((it, i) => (
        <div
          className={`polozka${i === index ? " polozka--vidno" : ""}`}
          key={it.id}
          aria-hidden={i !== index}
        >
          {it.kind === "menu" ? (
            menu ? (
              <Board initial={menu} />
            ) : (
              <p className="prazdne">Menu se načítá…</p>
            )
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={it.mediaPath} alt="" />
          )}
        </div>
      ))}

      <button className="celu-obrazovku" onClick={celuObrazovku}>
        Celá obrazovka
      </button>
    </div>
  );
}
