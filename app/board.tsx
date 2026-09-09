"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Group, Label, MenuData, OptionGroup } from "@/lib/menu";

/**
 * Japonská ozdoba k nadpisu — čisto dekorácia, hľadá sa podľa názvu kategórie.
 * Keď klient kategóriu premenuje na niečo neznáme, kana sa proste nezobrazí
 * a layout beží ďalej. Nikdy nesmie nič rozbiť.
 */
const KANA: [RegExp, string][] = [
  [/ramen|rámen/i, "ラーメン"],
  [/chuťovk|chutovk|snack|předkrm|predkrm|starter/i, "前菜"],
  [/dezert|dessert|sweet|zákusk|zakusk/i, "甘味"],
  [/dětsk|detsk|kid|children/i, "お子様"],
  [/nápoj|napoj|drink/i, "飲み物"],
  [/alkohol|pivo|víno|vino|beer|wine/i, "酒"],
];
const kanaFor = (name: string) =>
  KANA.find(([re]) => re.test(name))?.[1] ?? null;

/* ---------- pomocné ---------- */

/**
 * Všetky značky, ktoré ChoiceQR pozná — typy sú overené proti ich frontendu,
 * české a anglické znenie je prevzaté 1:1 z klientovho webu, nech to sedí.
 * Pálivosť má v ChoiceQR dva stupne (`middle-spicy` a `spicy`); `hot-spicy`
 * držíme pre prípad, že ho niekedy doplnia.
 */
const LABELS: Record<string, { cls: string; cz: string; en: string }> = {
  vegan: { cls: "veg", cz: "Veganské", en: "Vegan" },
  vegetarian: { cls: "veg", cz: "Vegetariánské", en: "Vegetarian" },
  gluten: { cls: "gf", cz: "Bezlepkové", en: "Gluten free" },
  "middle-spicy": { cls: "hot hot--mid", cz: "Středně pikantní", en: "Middle spicy" },
  spicy: { cls: "hot hot--full", cz: "Pikantní", en: "Spicy" },
  "hot-spicy": { cls: "hot hot--max", cz: "Velmi pikantní", en: "Very spicy" },
  alcohol: { cls: "alc", cz: "Alkohol", en: "Alcohol" },
  recommended: { cls: "rec", cz: "Doporučujeme", en: "Recommended" },
  new: { cls: "new", cz: "Nové", en: "New" },
};

/** Poradie na doske je pevné, nech sa značky nepreskupujú, keď klient niečo zapne. */
const LABEL_ORDER = Object.keys(LABELS);

/** Neznámy typ spravíme aspoň čitateľným: "lactose-free" -> "Lactose free". */
const prettify = (t: string) =>
  t.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function Tags({ labels }: { labels: Label[] }) {
  const seen = new Set<string>();
  const out: { cls: string; cz: string; en?: string }[] = [];
  for (const l of [...labels].sort((a, b) => {
    const r = (t: string) => {
      const i = LABEL_ORDER.indexOf(t);
      return i === -1 ? LABEL_ORDER.length : i;
    };
    return r(a.type) - r(b.type);
  })) {
    // vlastnú značku klienta ani neznámy typ nezahadzujeme — radšej ju vypíšeme
    const t = LABELS[l.type] ?? {
      cls: "own",
      cz: l.name || prettify(l.type),
      en: l.nameEn,
    };
    if (!t.cz || seen.has(t.cz)) continue;
    seen.add(t.cz);
    // keď klient vlastnú značku nepreložil, EN mutácia je tá istá — nepíšeme ju dvakrát
    out.push(t.en === t.cz ? { ...t, en: undefined } : t);
  }
  if (!out.length) return null;
  return (
    <>
      {out.map((l) => (
        <span key={l.cz} className={`tag ${l.cls}`}>
          {l.cz}
          {l.en && <span className="tag__en"> / {l.en}</span>}
        </span>
      ))}
    </>
  );
}

/**
 * Popis ako zoznam ingrediencií. Každý kus je vlastný inline-block, takže sa
 * NIKDY nezlomí vnútri ("čajové vejce" ostane pokope) a riadok končí čiarkou.
 */
function Ingredients({ parts, className }: { parts: string[]; className: string }) {
  if (!parts.length) return null;
  return (
    <p className={className}>
      {parts.map((p, i) => (
        <span className="ing" key={i}>
          {p}
          {i < parts.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}

function DishRow({
  d,
  currency,
  noPhoto,
}: {
  d: Dish;
  currency: string;
  /** krajné stĺpce sú úzke — fotky sú len v strednom ramen bloku */
  noPhoto?: boolean;
}) {
  const out = !d.available;
  const showPhoto = !noPhoto && !!d.image;
  return (
    <article
      className={`dish${out ? " out" : ""}${showPhoto ? " has-photo" : ""}`}
    >
      {showPhoto && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className="photo" src={d.image} alt="" loading="eager" />
      )}
      <h3 className="name">{d.name}</h3>
      <div className="price">
        {d.price}
        <small>{currency}</small>
      </div>
      {d.nameEn && d.nameEn.toLowerCase() !== d.name.toLowerCase() && (
        <div className="name-en">{d.nameEn}</div>
      )}
      <Ingredients parts={d.parts} className="desc" />
      <Ingredients parts={d.partsEn} className="desc-en" />
      {/* 1. riadok: len štítky (Doporučujeme, Novinka, Pálivé, …).
          Vypredané tu ZÁMERNE nemá vlastný štítok — pridával štvrtý prvok,
          riadok sa zalomil a jedlo prerástlo svoj slot cez susedné. Že je
          vypredané, povie prečiarknutý názov aj cena, stlmenie a šedá fotka. */}
      {d.labels.length > 0 && (
        <div className="meta">
          <Tags labels={d.labels} />
        </div>
      )}
      {/* 2. riadok: kalórie a alergény vždy spolu a vždy zvlášť — inak sa raz
          zalomia a raz nie, podľa toho, koľko štítkov je nad nimi */}
      {(d.kcal || d.allergens.length > 0) && (
        <div className="meta meta--alg">
          {d.kcal ? <span>{d.kcal} kcal</span> : null}
          {d.allergens.length ? <span>alerg. {d.allergens.join(", ")}</span> : null}
        </div>
      )}
    </article>
  );
}

/**
 * Box s voľbami / prídavkami. Používa sa aj na povinnú voľbu (NUDLE),
 * aj na nepovinné doplnky (PŘÍDAVKY). Názvy idú z ChoiceQR.
 * Položky za 0 Kč sa zobrazujú tiež — pri povinnej voľbe je práve tá základná.
 */
function OptionBox({
  title,
  titleEn,
  groups,
  currency,
  variant,
}: {
  title: string;
  titleEn?: string;
  groups: OptionGroup[];
  currency: string;
  variant?: "choice";
}) {
  const usable = groups.filter((g) => g.items.length > 0);
  if (!usable.length) return null;
  const showLabels = usable.length > 1;
  return (
    <div className={`extras${variant === "choice" ? " extras--choice" : ""}`}>
      <h3>{title}</h3>
      {titleEn && <div className="en-h">{titleEn}</div>}
      {usable.map((g) => (
        <div className="extras__group" key={g.id}>
          {showLabels && <div className="extras__label">{g.name}</div>}
          <ul>
            {g.items.map((i) => {
              const en =
                i.nameEn &&
                i.nameEn.trim() &&
                i.nameEn.trim().toLowerCase() !== i.name.trim().toLowerCase()
                  ? i.nameEn.trim()
                  : null;
              /* ChoiceQR má pri nulovej položke len cenu 0 — text „v ceně"
                 aj jeho preklad sú naše, v dátach nič také nie je */
              const free = i.price === 0;
              return (
                <li key={i.name}>
                  <span>{i.name}</span>
                  <span className="leader" />
                  <span className={free ? "p p--incl" : "p"}>
                    {free ? "v ceně" : `+${i.price} ${currency}`}
                  </span>
                  {(en || free) && (
                    <span className="it-en">
                      <span>{en}</span>
                      {free && <span className="it-en__incl">incl.</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** nadpis kategórie — názov aj preklad idú z ChoiceQR, nie z kódu */
function SectionHead({
  name,
  nameEn,
  sub = false,
}: {
  name: string;
  nameEn?: string;
  sub?: boolean;
}) {
  const kana = kanaFor(name);
  const showEn =
    nameEn && nameEn.trim() && nameEn.trim().toLowerCase() !== name.trim().toLowerCase();
  return (
    <div className={`sec${sub ? " sec--sub" : ""}`}>
      <h2>{name}</h2>
      {kana && <span className="kana">{kana}</span>}
      {showEn && <span className="en">{nameEn}</span>}
    </div>
  );
}

/** celá kategória: nadpis + jedlá */
function CategoryBlock({
  group,
  currency,
  sub,
}: {
  group: Group;
  currency: string;
  sub?: boolean;
}) {
  return (
    <>
      <SectionHead name={group.name} nameEn={group.nameEn} sub={sub} />
      <div className="list">
        {group.dishes.map((d) => (
          /* CategoryBlock sa používa len v krajných stĺpcoch — bez fotiek */
          <DishRow key={d.id} d={d} currency={currency} noPhoto />
        ))}
      </div>
    </>
  );
}

function Clock() {
  const [t, setT] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setT(
        new Date().toLocaleTimeString("cs-CZ", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{t}</span>;
}

/* ---------- fullscreen ---------- */

function FullscreenButton() {
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const sync = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    // skratka "F" na diaľkovom / klávesnici
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  // v celoobrazovkovom režime (bežný chod na TV) tlačidlo nezobrazujeme vôbec
  if (fs) return null;

  return (
    <button className="fsbtn" onClick={toggle} aria-label="Celá obrazovka">
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4" />
      </svg>
      <span>Celá obrazovka</span>
    </button>
  );
}

/* skryje kurzor po 3 s nečinnosti — na TV šípka inak trčí na obrazovke */
/**
 * Krajný stĺpec, ktorý sa sám prispôsobí počtu položiek.
 *
 * Klient môže v ChoiceQR chuťovky pridávať aj uberať. Namiesto hádania podľa
 * počtu odmeriame skutočnú výšku obsahu a po krokoch zmenšujeme mierku
 * (`--fit`), kým sa všetko nezmestí. Tým je zaručené, že vidno VŠETKO —
 * aj keď má niektorá položka dlhší popis.
 *
 * Beží len pri zmene dát / rozmerov, nie každý snímok — na TV to nič nestojí.
 */
function FitColumn({
  children,
  signature,
}: {
  children: React.ReactNode;
  /** zmena tohto reťazca spustí prepočet (počet + názvy položiek) */
  signature: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.setProperty("--fit", "1");
      let s = 1;
      // 16 krokov po 3,5 % => v najhoršom prípade zmenší na 60 %
      for (let i = 0; i < 16 && el.scrollHeight > el.clientHeight + 1; i++) {
        s = Math.round((s - 0.035) * 1000) / 1000;
        if (s < 0.6) break;
        el.style.setProperty("--fit", String(s));
      }
    };

    fit();
    // písma sa načítajú neskôr a zmenia metriku textu -> prepočítať
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [signature]);

  return (
    <section ref={ref} className="col col--narrow">
      {children}
    </section>
  );
}

/**
 * Stredný blok má sloty s PEVNOU výškou, aby ramen po vypnutí iného nepreskočil.
 * Lenže mriežka slot sama nezväčší — keby bol niektorý ramen vyšší, pretiekol by
 * cez ten pod ním. Preto sa to premeria a v takom prípade sa zapne hustejšia
 * sadzba. Meranie je spoľahlivejšie než pravidlo podľa počtu jedál: záleží na
 * tom, aké dlhé texty a koľko štítkov klient v ChoiceQR napíše.
 *
 * `dense` sa nasadzuje priamo na element, nie cez React — className v JSX je
 * nemenný, takže ho React pri prekreslení neprepíše.
 */
/** Anglický popis ramenov: strop je overený meraním, pod spodok nejdeme. */
const MAX_DESC_EN = 1.2;
const MIN_DESC_EN = 1.0;
/** Spodná hranica zmenšovania štítkov; 4 dvojjazyčné sa do nej ešte zmestia. */
const MIN_TAG_FIT = 0.6;

function useDenseGrid(signature: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const meraj = () => {
      el.classList.remove("dense"); // vždy meriame v normálnom režime

      // 1) Anglický popis čo najväčší, ale stále CELÝ na dva riadky.
      //    Nezvolíme veľkosť natvrdo: keď klient popis predĺži, doska sa
      //    sama stiahne, namiesto toho aby preklad odsekla.
      const orezany = () =>
        [...el.querySelectorAll<HTMLElement>(".desc-en")].some(
          (e) => e.scrollHeight > e.clientHeight + 1,
        );
      let v = MAX_DESC_EN;
      el.style.setProperty("--desc-en", `${v}vh`);
      while (v > MIN_DESC_EN && orezany()) {
        v = Math.round((v - 0.03) * 100) / 100;
        el.style.setProperty("--desc-en", `${v}vh`);
      }

      // 2) Štítky vždy na JEDEN riadok. Tretí štítok by sa inak zalomil, jedlo
      //    by narástlo a tlačilo to pod sebou. Meria sa každý riadok zvlášť —
      //    jedlá majú rôzne dlhé štítky, spoločná veľkosť by zbytočne zmenšila
      //    aj tie, ktoré sa v pohode zmestia.
      for (const m of el.querySelectorAll<HTMLElement>(".meta:not(.meta--alg)")) {
        const pretecie = () => m.scrollWidth > m.clientWidth + 1;
        const zmensuj = (spodok: number) => {
          let t = 1;
          m.style.removeProperty("--tag-fit");
          while (t > spodok && pretecie()) {
            t = Math.round((t - 0.04) * 100) / 100;
            m.style.setProperty("--tag-fit", String(t));
          }
        };

        m.style.flexWrap = "";

        // Preklad ostáva vždy — zmenší sa celý štítok aj s ním.
        zmensuj(MIN_TAG_FIT);

        // Posledná záchrana pri nezmyselnom počte — zalomiť je lepšie než odseknúť.
        if (pretecie()) m.style.flexWrap = "wrap";
      }

      // 3) Až potom výška — písmo aj štítky ju ovplyvňujú.
      const riadky = getComputedStyle(el)
        .gridTemplateRows.split(" ")
        .map(parseFloat)
        .filter((n) => Number.isFinite(n));
      if (!riadky.length) return;
      const slot = Math.min(...riadky);
      const nezmesti = [...el.children].some(
        (c) => c.getBoundingClientRect().height > slot + 1,
      );
      if (nezmesti) el.classList.add("dense");
    };
    meraj();
    document.fonts?.ready.then(meraj).catch(() => {});
    window.addEventListener("resize", meraj);
    return () => window.removeEventListener("resize", meraj);
  }, [signature]);
  return ref;
}

function useIdleCursor() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      document.body.classList.remove("idle");
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.add("idle"), 3000);
    };
    show();
    window.addEventListener("mousemove", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", show);
    };
  }, []);
}

/* ---------- doska ---------- */

export default function Board({ initial }: { initial: MenuData }) {
  const [data, setData] = useState<MenuData>(initial);
  useIdleCursor();

  // živé dáta: refresh každých 5 minút, ticho, bez bliknutia
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/menu", { cache: "no-store" });
        if (r.ok) setData(await r.json());
      } catch {
        /* offline -> necháme posledné dobré dáta na obrazovke */
      }
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // pri zmene obsahu krajných stĺpcov sa prepočíta ich mierka
  const sig = (gs: Group[]) =>
    gs.map((g) => g.name + ":" + g.dishes.map((d) => d.id).join(",")).join("|");
  /* 8 ramenov -> 4+4, 7 -> 4+3, 6 -> 3+3, 5 -> 3+2 … presne ako to chce klient */
  const rows = Math.ceil((data.main?.dishes.length ?? 0) / 2) || 1;
  const mainRef = useDenseGrid(
    (data.main?.dishes ?? [])
      .map((d) => `${d.id}${d.available ? "" : "!"}${d.labels.length}`)
      .join(","),
  );
  const leftSig = sig(data.left);
  const rightSig =
    sig(data.right) +
    "|" +
    [...data.choices, ...data.extras].map((g) => g.items.length).join(",");

  const c = data.currency;
  const bg = data.place.background;

  return (
    <div className="board">
      {bg && (
        <div className="board__bg" style={{ backgroundImage: `url(${bg})` }} />
      )}
      <header className="top">
        <div className="brand">
          <span className="brandmark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/logo.png" alt="Ramen Brno" />
            {/* odlesk – prejde cez logo každých ~6 s, orezaný maskou na tvar loga */}
            <span className="gleam" aria-hidden="true" />
          </span>
          <span className="kana">ラーメン</span>
          <span className="sub">Václavská · Brno</span>
        </div>
        <span className="menu-title">
          MENU<span className="kana"> メニュー</span>
        </span>
        <div className="top-right">
          {/* klient nechce v hlavičke signalizáciu otvorené/zavreté — len hodiny */}
          {data.workTime && (
            <span className="status">
              {data.workTime.from.slice(0, 5)}–{data.workTime.till.slice(0, 5)}
            </span>
          )}
          <Clock />
        </div>
      </header>

      <main className="cols">
        {/* 1 — ľavý krajný stĺpec: kategórie z ChoiceQR.
               Sám sa zmenší, keď klient pridá ďalšie chuťovky. */}
        <FitColumn signature={leftSig}>
          {data.left.map((g, i) => (
            <CategoryBlock key={g.id} group={g} currency={c} sub={i > 0} />
          ))}
        </FitColumn>

        {/* 2 — najväčšia kategória: JEDEN široký blok, jeden nadpis.
               Do dvoch podstĺpcov ho rozloží CSS, poradie z ChoiceQR ostáva. */}
        <section className="col col--wide">
          {data.main && (
            <>
              <div className="sec sec--center">
                <h2>{data.main.name}</h2>
                {kanaFor(data.main.name) && (
                  <span className="kana">{kanaFor(data.main.name)}</span>
                )}
              </div>
              {/* Mriežka 2 stĺpce × N riadkov s rovnako vysokými slotmi.
                  `grid-auto-flow: column` plní najprv ľavý stĺpec zhora nadol
                  a až potom pravý — poradie z ChoiceQR teda ostáva.

                  `--rows` je koľko riadkov naozaj treba: ceil(n/2) rozdelí
                  jedlá tak, ako to chce klient — 8→4+4, 7→4+3, 6→3+3, 5→3+2.
                  `--slot-rows` je referencia pre VÝŠKU slotu a nikdy neklesne
                  pod 4 (= plných 8 ramenov). Vďaka tomu zostanú položky pri
                  vypnutí jedného jedla na svojich miestach a voľné miesto
                  ostane dole; keby klient niekedy pridal deviate jedlo,
                  referencia narastie s ním, takže sa to neprepečie. */}
              <div
                ref={mainRef}
                className="list tight twocol"
                style={
                  {
                    "--rows": rows,
                    "--slot-rows": Math.max(4, rows),
                  } as React.CSSProperties
                }
              >
                {data.main.dishes.map((d) => (
                  <DishRow key={d.id} d={d} currency={c} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* 4 — pravý krajný stĺpec + přídavky dole (tiež sa prispôsobí) */}
        <FitColumn signature={rightSig}>
          {data.right.map((g, i) => (
            <CategoryBlock key={g.id} group={g} currency={c} sub={i > 0} />
          ))}

          <div className="addons">
            {/* povinné voľby (napr. výber nudlí) — vlastná sekcia NAD prídavkami */}
            {data.choices.map((g) => (
              <OptionBox
                key={g.id}
                title={g.name}
                titleEn={
                  g.nameEn && g.nameEn.trim().toLowerCase() !== g.name.trim().toLowerCase()
                    ? g.nameEn.trim()
                    : undefined
                }
                groups={[g]}
                currency={c}
                variant="choice"
              />
            ))}
            <OptionBox
              title="PŘÍDAVKY"
              titleEn="Extras — add to any bowl"
              groups={data.extras}
              currency={c}
            />
          </div>
        </FitColumn>
      </main>

      <FullscreenButton />
    </div>
  );
}
