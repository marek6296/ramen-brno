"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/app/board";
import type { MenuData } from "@/lib/menu";
import type { Screen } from "@/lib/storage/types";
import "./player.css";

/** ako často sa TV pýta, či klient niečo nezmenil */
const DOPYT_MS = 15_000;

export default function Player({ initial }: { initial: Screen }) {
  const [screen, setScreen] = useState(initial);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [index, setIndex] = useState(0);
  const [bezKurzora, setBezKurzora] = useState(false);
  const casovac = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** prvky <video> podľa id položky — cez ne sa púšťa a zastavuje prehrávanie */
  const videa = useRef(new Map<string, HTMLVideoElement>());

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

  /* Menu ťaháme cez existujúci proxy, ten istý, čo používa produkčná TV.
     Načítame ho LEN RAZ — Board si ďalej obnovuje sám (má vlastný interval),
     takže opakovaný dopyt odtiaľto by bol zbytočná prevádzka na každej TV. */
  useEffect(() => {
    if (!maMenu) return;
    let zive = true;
    (async () => {
      try {
        const r = await fetch("/api/menu");
        if (!r.ok) return;
        const d = (await r.json()) as MenuData;
        if (zive) setMenu(d);
      } catch {
        /* keď ChoiceQR chvíľu nič nepošle, necháme na obrazovke to staré */
      }
    })();
    return () => {
      zive = false;
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

  /* Videá: hrá len to, ktoré je práve vidieť, ostatné stoja.
     Prvky <video> pritom ZOSTÁVAJÚ V DOM celý čas — presne ako obrázky.
     Keby sa skrytá položka odpájala, televízor by si súbor stiahol znova pri
     každom kole sledu; pri niekoľkomegabajtovom videu a kole každých pár
     minút je to nonstop, 24/7, a mesačný prenos dát vyletí na stovky GB.
     Preto sa mení len viditeľnosť a prehrávanie, nikdy nie obsah DOM.

     Skryté video sa zároveň nemá točiť do prázdna: zbytočne by žralo výkon
     televízora a po návrate by začalo v náhodnom mieste. */
  useEffect(() => {
    const aktivne = items[index]?.id;
    for (const [id, el] of videa.current) {
      if (id === aktivne) {
        // Bez zvuku (`muted`) prehliadače automatické prehratie dovolia;
        // keby ho aj tak odmietli, obrazovka kvôli tomu nesmie spadnúť.
        el.play().catch(() => {});
      } else {
        el.pause();
        // Návrat na začiatok, nech klip vždy nastúpi od prvého záberu. Súbor
        // je už stiahnutý, takže sa tým nič neťahá znova — je to tá istá
        // operácia, akú robí `loop` na konci každého prehratia.
        el.currentTime = 0;
      }
    }
  }, [index, items]);

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
    <div
      className={`prehravac prehravac--${screen.orientation}${
        bezKurzora ? " prehravac--bez-kurzora" : ""
      }`}
    >
      {items.length === 0 && (
        <p className="prazdne">
          Obrazovka „{screen.name}" zatiaľ nemá nastavený žiadny obsah.
        </p>
      )}

      {items.map((it, i) => (
        <div
          className={`polozka polozka--prechod-${it.transition}${
            it.kind === "menu" ? " polozka--menu" : ""
          }${i === index ? " polozka--vidno" : ""}`}
          key={it.id}
          aria-hidden={i !== index}
        >
          {it.kind === "menu" ? (
            menu ? (
              <Board initial={menu} />
            ) : (
              <p className="prazdne">Menu se načítá…</p>
            )
          ) : it.kind === "video" ? (
            <video
              ref={(el) => {
                if (el) videa.current.set(it.id, el);
                else videa.current.delete(it.id);
              }}
              src={it.mediaPath}
              // Zvuk je vypnutý zámerne a natrvalo: prehliadače automatické
              // prehratie so zvukom nedovolia a obísť sa to nedá.
              muted
              loop
              playsInline
              preload="auto"
            />
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
