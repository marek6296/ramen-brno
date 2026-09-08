"use client";

import { useEffect, useState } from "react";
import type { Dish, Group, MenuData, OptionGroup } from "@/lib/menu";

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

const LABELS: Record<string, { cls: string; cz: string; en: string }> = {
  vegetarian: { cls: "veg", cz: "Vegetariánské", en: "Vegetarian" },
  vegan: { cls: "veg", cz: "Vegan", en: "Vegan" },
  "middle-spicy": { cls: "hot", cz: "Pálivé", en: "Spicy" },
  "hot-spicy": { cls: "hot", cz: "Velmi pálivé", en: "Very spicy" },
  spicy: { cls: "hot", cz: "Pálivé", en: "Spicy" },
  new: { cls: "new", cz: "Novinka", en: "New" },
  recommended: { cls: "rec", cz: "Doporučujeme", en: "Chef's pick" },
};

function Tags({ labels }: { labels: string[] }) {
  const seen = new Set<string>();
  const out = labels
    .map((l) => LABELS[l])
    .filter((l): l is (typeof LABELS)[string] => {
      if (!l || seen.has(l.cz)) return false;
      seen.add(l.cz);
      return true;
    });
  if (!out.length) return null;
  return (
    <>
      {out.map((l) => (
        <span key={l.cz} className={`tag ${l.cls}`}>
          {l.cz} <span style={{ opacity: 0.6 }}>/ {l.en}</span>
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

function DishRow({ d, currency }: { d: Dish; currency: string }) {
  const out = !d.available;
  return (
    <article
      className={`dish${out ? " out" : ""}${d.image ? " has-photo" : ""}`}
    >
      {d.image && (
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
      {/* 1. riadok: len štítky (Doporučujeme, Novinka, Pálivé, …) */}
      {(out || d.labels.length > 0) && (
        <div className="meta">
          {out && <span className="soldout">Vyprodáno / Sold out</span>}
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
          <DishRow key={d.id} d={d} currency={currency} />
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
          <span className="status">
            <span className={`dot${data.place.opened ? "" : " off"}`} />
            {data.place.opened ? "Otevřeno" : "Zavřeno"}
            {data.workTime && (
              <span style={{ opacity: 0.6 }}>
                {" "}
                · {data.workTime.from.slice(0, 5)}–{data.workTime.till.slice(0, 5)}
              </span>
            )}
          </span>
          <Clock />
        </div>
      </header>

      <main className="cols">
        {/* 1 — ľavý krajný stĺpec: kategórie z ChoiceQR */}
        <section className="col col--narrow">
          {data.left.map((g, i) => (
            <CategoryBlock key={g.id} group={g} currency={c} sub={i > 0} />
          ))}
        </section>

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
                  a až potom pravý — poradie z ChoiceQR teda ostáva. */}
              <div
                className="list tight twocol"
                style={
                  {
                    "--rows": Math.ceil(data.main.dishes.length / 2),
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

        {/* 4 — pravý krajný stĺpec + přídavky dole */}
        <section className="col col--narrow">
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
        </section>
      </main>

      <FullscreenButton />
    </div>
  );
}
