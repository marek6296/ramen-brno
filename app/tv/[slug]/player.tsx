"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@/app/board";
import BoardPortrait from "@/app/board-portrait";
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
  /** koľkokrát už práve zobrazené video dohralo od začiatku svojho kola */
  const prehratia = useRef(0);
  /** true = aktívne video má odhraté svoje a čaká sa len na prepnutie */
  const dohrate = useRef(false);

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

  /* Striedanie položiek. Beží podľa trvania práve zobrazenej položky —
     pri videu však podľa počtu prehratí, viď efekt s videami nižšie. */
  const podpis = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.id}:${i.kind}:${i.durationS}:${i.repeats}:${i.transition}:${i.mediaPath}`,
        )
        .join(","),
    [items],
  );

  useEffect(() => {
    setIndex(0);
  }, [podpis]);

  /** prepne na ďalšiu položku sledu; pri jedinej položke nemá kam */
  const dalsia = useCallback(() => {
    setIndex((i) => (items.length < 2 ? i : (i + 1) % items.length));
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    /* Video sa neodmeriava sekundami — nikto nevie, koľko klip trvá, a keď sa
       netrafí, buď sa ustrihne, alebo potom stojí na poslednom snímku.
       Prepína ho efekt nižšie, keď dohrá zadaný počet ráz. */
    if (items[index]?.kind === "video") return;
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
    const aktivna = items[index];
    const aktivne = aktivna?.id;
    const jeVideo = aktivna?.kind === "video";
    const opakovani = Math.max(1, Math.round(aktivna?.repeats ?? 1));

    // Nové kolo: počítadlo prehratí ide od nuly a klip od prvého snímku.
    prehratia.current = 0;
    dohrate.current = false;
    const aktivnyPrvok = aktivne ? videa.current.get(aktivne) : undefined;
    if (jeVideo && aktivnyPrvok) aktivnyPrvok.currentTime = 0;

    const zrovnaj = () => {
      for (const [id, el] of videa.current) {
        if (id === aktivne) {
          // Keď už klip odhral svoje a čaká sa len na prepnutie, strážca ho
          // NESMIE rozbehnúť znova — inak by sa po dohraní na okamih rozbehol
          // ďalšie kolo a divák by videl trhnutie.
          if (dohrate.current) continue;
          // Bez zvuku (`muted`) prehliadače automatické prehratie dovolia;
          // keby ho aj tak odmietli, obrazovka kvôli tomu nesmie spadnúť.
          if (el.paused) el.play().catch(() => {});
        } else if (!el.paused || el.currentTime !== 0) {
          el.pause();
          // Návrat na začiatok, nech klip vždy nastúpi od prvého záberu. Súbor
          // je už stiahnutý, takže sa tým nič neťahá znova — je to to isté
          // pretočenie, aké robíme po každom dohraní.
          el.currentTime = 0;
        }
      }
    };

    zrovnaj();

    /* JEDEN pokus nestačí a stálo nás to celý večer ladenia. Prehliadač vie
       `play()` odmietnuť (ešte nie sú dáta, pravidlá pre automatické
       prehrávanie) a chyba sa pritom ticho zahodí, takže video zostane stáť
       na prvom snímku a na televízore, ktorý beží celý deň, si toho nikto
       nevšimne. Preto sa stav pravidelne porovná a v prípade potreby naprávi.
       Pri sekundovom intervale bolo pri každom pretočení vidieť zámrz; 250 ms
       je nepostrehnuteľné a stojí to rovnako nič — je to len kontrola
       príznaku `paused`, nesťahuje sa pri nej nič. */
    const strazca = setInterval(zrovnaj, 250);

    /* POISTKA. Prepnutie ďalej visí na udalosti `ended`. Keby neprišla —
       poškodený súbor, zaseknutý dekodér televízora, uspatá karta — obrazovka
       by na tom videu zostala navždy a klient by o tom vedel až od hostí.
       Preto tu beží záložný časovač na o päť sekúnd dlhšie, než by mal celý
       zadaný počet prehratí trvať; keď dĺžku klipu ešte nepoznáme (metadáta
       nie sú načítané, `duration` je NaN), rátame konzervatívne s minútou. */
    if (!jeVideo || items.length < 2) return () => clearInterval(strazca);

    const dlzkaS = aktivnyPrvok?.duration;
    const jednoKoloS = Number.isFinite(dlzkaS) && (dlzkaS as number) > 0
      ? (dlzkaS as number)
      : 60;
    const poistka = setTimeout(dalsia, (opakovani * jednoKoloS + 5) * 1000);

    return () => {
      clearInterval(strazca);
      clearTimeout(poistka);
    };
    /* Zámerne `podpis` a nie `items`: dopyt na nastavenia beží každých 15 s
       a vracia nové pole aj vtedy, keď sa v ňom nič nezmenilo. Pri závislosti
       na identite poľa sa tým efekt spustil znova a vynuloval počítadlo
       prehratí — klip potom zahral raz navyše. Podpis sa zmení len vtedy,
       keď sa naozaj zmení obsah. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, podpis, dalsia]);

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
              /* Na výšku sa jedálny lístok skladá inak než na šírku — sekcie
                 idú pod sebou a jedlá v nich do dvoch stĺpcov. Sú to dve
                 samostatné dosky; tá na šírku beží klientovi v prevádzke
                 a nesmie sa kvôli tejto zmeniť. */
              screen.orientation === "portrait" ? (
                <BoardPortrait initial={menu} />
              ) : (
                <Board initial={menu} />
              )
            ) : (
              <p className="prazdne">Menu se načítá…</p>
            )
          ) : it.kind === "video" ? (
            <video
              /* Tu sa počítajú prehratia. `loop` na prvku ZÁMERNE NIE JE:
                 s ním prehliadač udalosť `ended` vôbec nevyšle (overené —
                 chodilo len `seeking`) a bez nej by sa nedalo zistiť, koľko
                 ráz už klip dohral. Pretočenie si preto robíme sami. */
              onEnded={(e) => {
                // Dohrať môže len to video, ktoré je práve vidieť; ostatné
                // stoja. Keby predsa prišlo od skrytého, nemá čo počítať.
                if (i !== index) return;
                const el = e.currentTarget;
                const potrebne = Math.max(1, Math.round(it.repeats ?? 1));
                prehratia.current += 1;

                // Pri jedinej položke v slede nie je kam prepnúť — klip sa
                // teda púšťa dookola, rovnako ako to predtým robil `loop`.
                if (prehratia.current < potrebne || items.length < 2) {
                  if (items.length < 2) prehratia.current = 0;
                  el.currentTime = 0;
                  el.play().catch(() => {});
                  return;
                }

                // Odhrané. Strážcovi tým povieme, že video už nemá rozbiehať.
                dohrate.current = true;
                dalsia();
              }}
              ref={(el) => {
                if (el) videa.current.set(it.id, el);
                else videa.current.delete(it.id);
              }}
              src={it.mediaPath}
              // Zvuk je vypnutý zámerne a natrvalo: prehliadače automatické
              // prehratie so zvukom nedovolia a obísť sa to nedá.
              muted
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
