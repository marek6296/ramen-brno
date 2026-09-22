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

const POPIS_ORIENTACIE: Record<Orientation, string> = {
  landscape: "na šírku",
  portrait: "na výšku",
};

/** Odtlačok stavu, ktorý sa ukladá. Lepiaca lišta podľa neho pozná, či má
 *  čo hlásiť — bez toho by svietila „neuložené" aj po uložení. */
const odtlacok = (n: string, o: Orientation, it: PlaylistItem[]) =>
  JSON.stringify({ n, o, it });

/** stav ťahania položky sledu prstom alebo myšou */
type Tah = {
  /** pôvodný index ťahanej položky */
  od: number;
  /** index, kam by položka pri pustení spadla */
  na: number;
  /** posun prsta od začiatku ťahania, v px */
  dy: number;
  /** o koľko px sa majú rozostúpiť ostatné riadky */
  krok: number;
};

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

  /* Ukladanie: `ulozeny` je odtlačok toho, čo naozaj leží na serveri. */
  const [ulozeny, setUlozeny] = useState(() =>
    odtlacok(screen.name, screen.orientation, screen.items),
  );
  const [uklada, setUklada] = useState(false);
  const [uloziloSa, setUloziloSa] = useState(false);
  const [chybaUloz, setChybaUloz] = useState("");
  const neulozene = odtlacok(name, orientation, items) !== ulozeny;

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
      // `repeats` nesie každá položka, aby typ sedel; využije ho len video
      { id: novyId(), kind: "menu", mediaPath: "", durationS: 30, transition: "fade", repeats: 1 },
    ]);
  }

  function pridajSlide(path: string) {
    setItems((z) => [
      ...z,
      { id: novyId(), kind: "image", mediaPath: path, durationS: 10, transition: "fade", repeats: 1 },
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
        // Pri videu sa `durationS` nepoužíva (prehrávač počíta prehratia),
        // necháme tam ale rozumnú hodnotu pre prípad, že by sa položka
        // niekedy prepla na iný typ.
        durationS: m.kind === "video" ? 15 : 10,
        transition: "fade",
        // nové video sa štandardne prehrá raz a ide sa ďalej
        repeats: 1,
      },
    ]);
  }

  async function obnovMedia() {
    const r = await fetch("/api/admin/media", { cache: "no-store" });
    if (!r.ok) return;
    setMediaZoznam((await r.json()) as MediaFile[]);
  }

  /* Dlaždica „+ Nahrať" otvorí výber súboru a nahráva sa hneď po výbere —
     dvojkrokové „vyber a potom stlač Nahrať" klienta zbytočne zdržiavalo. */
  async function nahraj(subor: File) {
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
      await obnovMedia();
      setMediaStav(`Nahraté: ${data.name}`);
    } catch {
      setMediaStav("Nahrávanie zlyhalo — skús to znova");
    } finally {
      // Pole vyprázdnime, nech sa ten istý súbor dá vybrať znova.
      if (vyberSuboru.current) vyberSuboru.current.value = "";
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

  /** presun položky z indexu `od` na index `na` (nie výmena — ťahanie sa
   *  musí správať ako vsunutie medzi susedov) */
  function presun(od: number, na: number) {
    setItems((z) => {
      if (od === na || od < 0 || na < 0 || od >= z.length || na >= z.length) return z;
      const kopia = [...z];
      const [vybrata] = kopia.splice(od, 1);
      kopia.splice(na, 0, vybrata);
      return kopia;
    });
  }

  function posun(i: number, o: number) {
    presun(i, i + o);
  }

  function trvanie(id: string, s: number) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, durationS: s } : i)));
  }

  function prechod(id: string, t: Transition) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, transition: t } : i)));
  }

  function opakovania(id: string, n: number) {
    setItems((z) => z.map((i) => (i.id === id ? { ...i, repeats: n } : i)));
  }

  /* ------------------------------------------------------------------ *
   * Ťahanie položiek sledu.
   *
   * Zámerne cez pointer events, NIE cez HTML5 drag-and-drop — ten na dotyku
   * nefunguje. Úchyt má `touch-action: none`, takže prst pri ťahaní neroluje
   * stránku, a `setPointerCapture` drží ďalšie udalosti na úchyte aj vtedy,
   * keď prst zíde mimo neho.
   * ------------------------------------------------------------------ */

  const sledRef = useRef<HTMLUListElement>(null);
  const [tah, setTah] = useState<Tah | null>(null);
  /* Rozstup riadkov meriame RAZ na začiatku ťahania. Počas ťahania sa riadky
     posúvajú transformom, takže ich živé rozmery by lietali. */
  const pocet = useRef(0);
  const zaciatokY = useRef(0);

  function zacniTah(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    // pravé tlačidlo myši ťahanie nespúšťa
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const zoznam = sledRef.current;
    if (!zoznam) return;

    const riadky = Array.from(zoznam.children) as HTMLElement[];
    const miery = riadky.map((r) => r.getBoundingClientRect());
    if (miery.length < 2) return; // jedna položka sa preskladať nedá

    pocet.current = miery.length;
    zaciatokY.current = e.clientY;
    // krok = rozstup dvoch susedných riadkov (výška aj s medzerou pod ňou)
    const krok = Math.max(1, miery[1].top - miery[0].top);

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault(); // na myši zabráni označovaniu textu
    setTah({ od: index, na: index, dy: 0, krok });
  }

  function pokracujTah(e: React.PointerEvent<HTMLButtonElement>) {
    setTah((t) => {
      if (!t) return t;
      const dy = e.clientY - zaciatokY.current;
      /* Riadky sledu sú rovnako vysoké (názov sa neláme, ovládanie má pevnú
         výšku), takže cieľový index je jednoduchý podiel. Zaokrúhľovanie
         znamená, že sa poradie preklopí už po polovici riadka — porovnávanie
         stredov by si vyžiadalo celý riadok a ťahanie by pôsobilo lenivo. */
      const na = Math.min(
        pocet.current - 1,
        Math.max(0, t.od + Math.round(dy / t.krok)),
      );
      return { ...t, dy, na };
    });
  }

  function ukonciTah(e: React.PointerEvent<HTMLButtonElement>, pustit: boolean) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!tah) return;
    if (pustit) presun(tah.od, tah.na);
    setTah(null);
  }

  /** o koľko je riadok `i` posunutý, kým sa ťahá */
  function posunRiadka(i: number): string | undefined {
    if (!tah) return undefined;
    if (i === tah.od) return `translateY(${tah.dy}px)`;
    if (tah.od < tah.na && i > tah.od && i <= tah.na) return `translateY(${-tah.krok}px)`;
    if (tah.od > tah.na && i >= tah.na && i < tah.od) return `translateY(${tah.krok}px)`;
    return "translateY(0px)";
  }

  /* --------------------------------------------------------- ukladanie --- */

  async function uloz() {
    setUklada(true);
    setChybaUloz("");
    const posielane = { name, orientation, items };
    try {
      const r = await fetch(`/api/admin/screens/${screen.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(posielane),
      });
      const data = await r.json();
      if (!r.ok) {
        setChybaUloz(data.error ?? "Nepodarilo sa uložiť");
        return;
      }
      setSlug((data as Screen).slug); // adresa sa nemení, len si držíme pravdu zo servera
      setUlozeny(odtlacok(posielane.name, posielane.orientation, posielane.items));
      setUloziloSa(true);
    } catch {
      setChybaUloz("Server neodpovedal — skús to znova");
    } finally {
      setUklada(false);
    }
  }

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
      <header className="hlavicka">
        <h1>
          {screen.name}
          <span className="hlavicka__popis">Úprava obrazovky</span>
        </h1>
        <Link className="tl tl--tmave tl--male" href="/admin">
          ← Zoznam
        </Link>
      </header>

      {/* ------------------------------------------------- nastavenia --- */}
      <section className="karta" style={{ "--i": 0 } as React.CSSProperties}>
        <h3>Nastavenia obrazovky</h3>
        <div className="nastavenia">
          <label className="pole">
            <span className="pole__popis">Názov</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
        <p className="adresa">
          <span className="adresa__text">/tv/{slug}</span>
          <span className="ticho">adresa sa premenovaním nemení</span>
        </p>
      </section>

      {/* ------------------------------------------------------- sled --- */}
      <section className="karta" style={{ "--i": 1 } as React.CSSProperties}>
        <h2>Sled na obrazovke</h2>
        {items.length === 0 ? (
          <p className="ticho" style={{ marginTop: "0.6rem" }}>
            Sled je prázdny — obrazovka zatiaľ nič neukáže. Pridaj niečo nižšie.
          </p>
        ) : (
          <>
            <p className="ticho" style={{ marginTop: "0.35rem" }}>
              Poradie zmeníš ťahaním za úchyt ⠿ alebo šípkami.
            </p>
            <ul className="sled" ref={sledRef}>
              {items.map((i, index) => (
                <li
                  className={
                    tah?.od === index ? "sled__riadok sled__riadok--tahany" : "sled__riadok"
                  }
                  key={i.id}
                  style={{ transform: posunRiadka(index) }}
                >
                  <button
                    type="button"
                    className="sled__uchyt"
                    aria-label={`Presunúť položku ${index + 1}`}
                    title="Ťahaním zmeníš poradie"
                    onPointerDown={(e) => zacniTah(e, index)}
                    onPointerMove={pokracujTah}
                    onPointerUp={(e) => ukonciTah(e, true)}
                    onPointerCancel={(e) => ukonciTah(e, false)}
                  >
                    ⠿
                  </button>

                  <div className="sled__telo">
                    <div className="sled__hlava">
                      <span className="sled__poradie">{index + 1}</span>
                      <span className="sled__nazov" title={nazov(i)}>
                        {nazov(i)}
                      </span>
                      <button
                        type="button"
                        className="sled__x"
                        aria-label={`Odobrať položku ${index + 1} zo sledu`}
                        onClick={() => odober(i.id)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="sled__ovladanie">
                      {/* Pri videu sú sekundy na nič — nikto nevie, koľko klip
                          trvá. Zadáva sa preto počet prehratí a prehrávač si
                          počká, kým klip dohrá. Pri menu a obrázku zostávajú
                          sekundy. */}
                      {i.kind === "video" ? (
                        <span className="sled__cislo">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            aria-label={`Počet prehratí položky ${index + 1}`}
                            title="koľkokrát sa klip prehrá"
                            value={i.repeats}
                            onChange={(e) => opakovania(i.id, Number(e.target.value))}
                          />
                          <span className="sled__jednotka" title="koľkokrát sa klip prehrá">
                            ×
                          </span>
                        </span>
                      ) : (
                        <span className="sled__cislo">
                          <input
                            type="number"
                            min={3}
                            max={3600}
                            aria-label={`Trvanie položky ${index + 1} v sekundách`}
                            value={i.durationS}
                            onChange={(e) => trvanie(i.id, Number(e.target.value))}
                          />
                          <span className="sled__jednotka">s</span>
                        </span>
                      )}

                      <select
                        className="sled__prechod"
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

                      {/* Šípky zostávajú ako druhá cesta — na telefóne
                          s dlhším zoznamom je ťahanie otrava. */}
                      <span className="sled__sipky">
                        <button
                          type="button"
                          className="sled__sipka"
                          aria-label={`Posunúť položku ${index + 1} vyššie`}
                          onClick={() => posun(index, -1)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="sled__sipka"
                          aria-label={`Posunúť položku ${index + 1} nižšie`}
                          onClick={() => posun(index, 1)}
                          disabled={index === items.length - 1}
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* --------------------------------------------- zdroje do sledu --- */}
      {/* JEDNA spoločná sekcia. Menu, ukážkové slidy aj nahraté médiá sú
          v tej istej mriežke — klient nemá chodiť po troch miestach. */}
      <section className="karta" style={{ "--i": 2 } as React.CSSProperties}>
        <h2>Pridať do sledu</h2>
        <p className="ticho" style={{ marginTop: "0.35rem" }}>
          Ťuknutím sa položka pridá na koniec sledu.
        </p>

        <div className="mriezka">
          <button type="button" className="dlazdica dlazdica--menu" onClick={pridajMenu}>
            <span className="dlazdica__znak">MENU</span>
            <span className="dlazdica__popis">živé z ChoiceQR</span>
          </button>

          {slides.map((s) => {
            const sedi = s.orientation === orientation;
            return (
              <button
                type="button"
                key={s.path}
                className={sedi ? "dlazdica" : "dlazdica dlazdica--inak"}
                onClick={() => pridajSlide(s.path)}
                title={
                  sedi
                    ? s.label
                    : `${s.label} — slide je ${POPIS_ORIENTACIE[s.orientation]}, obrazovka ${POPIS_ORIENTACIE[orientation]}`
                }
              >
                <span className="dlazdica__obraz">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.path} alt="" />
                </span>
                {!sedi && (
                  <span className="dlazdica__stitok">
                    {POPIS_ORIENTACIE[s.orientation]}
                  </span>
                )}
                <span className="dlazdica__popis">{s.label}</span>
              </button>
            );
          })}

          {mediaZoznam.map((m) => (
            <div className="dlazdica" key={m.path}>
              <button
                type="button"
                className="dlazdica__plocha"
                onClick={() => pridajMedium(m)}
                title={m.name}
              >
                <span
                  className={
                    m.kind === "image"
                      ? "dlazdica__obraz"
                      : "dlazdica__obraz dlazdica__obraz--video"
                  }
                >
                  {m.kind === "image" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.url} alt="" />
                  ) : (
                    /* Video náhľad nekreslíme — prehliadač by si stiahol celý
                       súbor. Stačí ikona, že ide o video. */
                    <span aria-hidden="true">▶</span>
                  )}
                </span>
                <span className="dlazdica__popis">
                  {m.name}
                  <span className="dlazdica__vaha">{vMB(m.sizeB)}</span>
                </span>
              </button>
              <button
                type="button"
                className="dlazdica__zmaz"
                aria-label={`Zmazať súbor ${m.name}`}
                title="Zmazať súbor z úložiska"
                onClick={() => zmazMedium(m)}
              >
                ×
              </button>
            </div>
          ))}

          {mediaDostupne && (
            <button
              type="button"
              className="dlazdica dlazdica--nahrat"
              onClick={() => vyberSuboru.current?.click()}
              disabled={nahravam}
            >
              <span className="dlazdica__znak">+</span>
              <span className="dlazdica__popis">
                {nahravam ? "Nahrávam…" : "Nahrať"}
              </span>
            </button>
          )}
        </div>

        <input
          className="skryte-pole"
          ref={vyberSuboru}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4"
          aria-label="Súbor na nahratie"
          onChange={(e) => {
            const subor = e.target.files?.[0];
            if (subor) nahraj(subor);
          }}
        />

        {mediaDostupne ? (
          <p className="ticho" style={{ marginTop: "0.8rem" }}>
            {mediaStav ||
              "JPEG, PNG, WebP, SVG a MP4, najviac 50 MB. Videá hrajú bez zvuku — televízory automatické prehratie so zvukom nedovolia."}
          </p>
        ) : (
          <p className="ticho" style={{ marginTop: "0.8rem" }}>
            Nahrávanie vlastných obrázkov a videí vyžaduje pripojenú databázu.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ lepiaca lišta --- */}
      <div className="lista">
        {chybaUloz ? (
          <span className="lista__stav" style={{ color: "var(--a-zla)" }}>
            {chybaUloz}
          </span>
        ) : uklada ? (
          <span className="lista__stav">Ukladám…</span>
        ) : neulozene ? (
          <span className="lista__stav lista__stav--neulozene">
            Neuložené zmeny
            <small>Kým neuložíš, na televízii sa nič nezmení.</small>
          </span>
        ) : uloziloSa ? (
          <span className="lista__stav lista__stav--ulozene">
            Uložené
            <small>TV sa prispôsobí do 15 sekúnd.</small>
          </span>
        ) : (
          <span className="lista__stav">Všetko uložené</span>
        )}
        <button
          type="button"
          className="tl tl--hlavne"
          onClick={uloz}
          disabled={uklada || !neulozene}
        >
          {uklada ? "Ukladám…" : "Uložiť"}
        </button>
      </div>
    </>
  );
}
