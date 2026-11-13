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
  style,
}: {
  d: Dish;
  currency: string;
  /** krajné stĺpce sú úzke — fotky sú len v strednom ramen bloku */
  noPhoto?: boolean;
  /** pozícia v mriežke ramenov */
  style?: React.CSSProperties;
}) {
  const out = !d.available;
  const showPhoto = !noPhoto && !!d.image;
  return (
    <article
      className={`dish${out ? " out" : ""}${showPhoto ? " has-photo" : ""}`}
      style={style}
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
      {d.nameEn && d.nameEn.toLowerCase() !== d.name.toLowerCase() ? (
        <div className="name-en">{d.nameEn}</div>
      ) : (
        /* Prázdne miesto namiesto chýbajúcej časti. Bez fotiek drží v strede
           ďalšie časti jedla na rovnakej výške ako u suseda v tom istom
           riadku (viď `zarovnajRiadky`); inde sa nezobrazuje. */
        <div className="name-en prazdne" aria-hidden="true" />
      )}
      {d.parts.length ? (
        <Ingredients parts={d.parts} className="desc" />
      ) : (
        <p className="desc prazdne" aria-hidden="true" />
      )}
      {d.partsEn.length ? (
        <Ingredients parts={d.partsEn} className="desc-en" />
      ) : (
        <p className="desc-en prazdne" aria-hidden="true" />
      )}
      {/* 1. riadok: len štítky (Doporučujeme, Novinka, Pálivé, …).
          Vypredané tu ZÁMERNE nemá vlastný štítok — pridával štvrtý prvok,
          riadok sa zalomil a jedlo prerástlo svoj slot cez susedné. Že je
          vypredané, povie prečiarknutý názov aj cena, stlmenie a šedá fotka. */}
      {/* Obal oboch riadkov. S fotkami má `display: contents` a riadky sú
          v mriežke jedla ako predtým; bez fotiek v strede idú kalórie
          s alergénmi navrch a štítky pod ne (viď globals.css). */}
      <div className="meta-riadok">
        {d.labels.length > 0 && (
          <div className="meta">
            <Tags labels={d.labels} />
          </div>
        )}
        {/* 2. riadok: kalórie a alergény vždy spolu a vždy zvlášť — inak sa raz
            zalomia a raz nie, podľa toho, koľko štítkov je nad nimi */}
        {d.kcal || d.allergens.length > 0 ? (
          <div className="meta meta--alg">
            {d.kcal ? <span>{d.kcal} kcal</span> : null}
            {d.allergens.length ? <span>alerg. {d.allergens.join(", ")}</span> : null}
          </div>
        ) : (
          <div className="meta meta--alg prazdne" aria-hidden="true" />
        )}
      </div>
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
/**
 * Úrovne úspory miesta v krajných stĺpcoch, od najšetrnejšej. `spodok` je
 * najmenšie písmo, pri ktorom sme ochotní na danej úrovni ostať.
 */
const UROVNE = [
  { cz: 4, en: 2, spodok: 0.86 },
  { cz: 3, en: 2, spodok: 0.78 },
  { cz: 2, en: 1, spodok: 0.55 },
];
/**
 * Najprv sa skúša s riadkom navyše. V krajných stĺpcoch býva voľné miesto
 * a dlhší preklad (napr. Karaage) by sa inak odsekol na dvoch riadkoch.
 * Bez fotiek je písmo väčšie a riadok navyše potrebuje ešte častejšie.
 */
const UROVEN_NAVYSE = { cz: 5, en: 3, spodok: 0.86 };
// Pozn.: do úzkeho stĺpca sa takto zmestí až šesť položiek (dohodnuté maximum
// klienta). Osem sa doň nevojde ani po zmenšení na 40 % — vtedy už nejde
// o sadzbu, ale o to, že sa doň dostala nesprávna kategória. Rieši sa to
// inak než zmenšovaním, tak sa netvárime, že to zmenšovanie zachráni.

function FitColumn({
  children,
  signature,
  maxFit = 1,
}: {
  children: React.ReactNode;
  /** zmena tohto reťazca spustí prepočet (počet + názvy položiek) */
  signature: string;
  /**
   * Odkiaľ začať. Bez fotiek je na doske miesto navyše, tak sa písmo smie
   * zväčšiť nad 1 — mierku `--fit` v krajných stĺpcoch používa len CSS
   * režimu bez fotiek, s fotkami ostáva doska presne ako bola.
   */
  maxFit?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const pretecie = () => el.scrollHeight > el.clientHeight + 1;

      // Postupujeme po úrovniach: najprv sa snažíme len zmenšiť a nechať popisy
      // celé; až keď by písmo spadlo pod čitateľnú mieru, skrátime popisy
      // a začneme znova od plnej veľkosti. Čitateľný text s kratším popisom
      // je na TV lepší než drobné písmo — a nadovšetko platí, že sa musia
      // zmestiť VŠETKY položky. Predtým sa zmenšovanie zastavilo na hranici
      // a šiesta chuťovka sa jednoducho odrezala.
      //
      // Bez fotiek sa písmo zväčšuje nad 1, a väčší popis sa ľahko nezmestí
      // do svojho počtu riadkov a dostane „…". Vtedy sa ráta ako nezmestený
      // aj orezaný popis — radšej o kúsok menšie písmo než useknutý text.
      // Na poslednej úrovni (2 + 1 riadok) je skracovanie zámer, tam nie.
      const urovne = [UROVEN_NAVYSE, ...UROVNE];
      for (const u of urovne) {
        el.style.setProperty("--cz-lines", String(u.cz));
        el.style.setProperty("--en-lines", String(u.en));
        const strazOrez = maxFit > 1 && u !== urovne[urovne.length - 1];
        const zle = () =>
          pretecie() ||
          (strazOrez && (orezane(el, ".desc") || orezane(el, ".desc-en"))) ||
          (maxFit > 1 && (zalomeneCeny(el) || vycnievaStitok(el)));
        let s = maxFit;
        el.style.setProperty("--fit", String(s));
        while (s > u.spodok && zle()) {
          s = Math.round((s - 0.02) * 1000) / 1000;
          el.style.setProperty("--fit", String(s));
        }
        if (!zle()) return;
      }
    };

    fit();
    // písma sa načítajú neskôr a zmenia metriku textu -> prepočítať
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [signature, maxFit]);

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
/**
 * Najmenšia mierka písma ramenov (`--fit`), pri ktorej ešte necháme popisy
 * celé. Český popis tak klesne najviac na ~1,4vh — rovnako ako v krajných
 * stĺpcoch, takže je to stále čitateľné z diaľky.
 */
const MIN_FIT = 0.86;
/**
 * Bez fotiek: najväčšia mierka písma, od ktorej sa začína. Doska ju zmenšuje,
 * kým sa všetko nezmestí, takže pri menšom počte jedál a kratších popisoch
 * je písmo väčšie, pri dlhších menšie — vždy čo najväčšie, aké sa zmestí.
 */
const MAX_FIT_BEZ_FOTIEK = 1.5;
/** to isté pre krajné stĺpce (chuťovky, dětské jídlo, prídavky) */
const MAX_FIT_KRAJ_BEZ_FOTIEK = 1.5;

/**
 * Prídavok, ktorému cena zliezla pod názov. Riadok prídavku sa smie lámať
 * (anglický názov ide na druhý riadok), takže to nie je pretečenie — pri
 * väčšom písme by sa ale cena odtrhla od bodkovanej linky.
 */
const zalomeneCeny = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>(".extras li")].some((li) => {
    const nazov = li.firstElementChild as HTMLElement | null;
    const cena = li.querySelector<HTMLElement>(".p");
    return !!nazov && !!cena && cena.offsetTop > nazov.offsetTop + 2;
  });

/**
 * Štítok širší než stĺpec. Riadok štítkov sa v krajných stĺpcoch smie lámať,
 * ale jeden dlhý štítok („Středně pikantní / Middle spicy") sa zlomiť nedá
 * a pri väčšom písme by vyčnieval cez okraj stĺpca.
 */
const vycnievaStitok = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>(".meta")].some(
    (m) => m.scrollWidth > m.clientWidth + 1,
  );

/** prvok, ktorému `-webkit-line-clamp` odsekol koniec textu („…") */
//
// Nespolieha sa len na `scrollHeight`: Safari pri `-webkit-line-clamp` hlási
// výšku už orezanú, takže by „…" nespoznal a doska by ostala pri väčšom písme
// s useknutým popisom. Preto sa pozerá aj na to, kde leží posledná zložka
// popisu — skryté riadky sú rozložené pod okrajom aj tam.
const orezane = (el: HTMLElement, sel: string) =>
  [...el.querySelectorAll<HTMLElement>(sel)].some((e) => {
    if (e.scrollHeight > e.clientHeight + 1) return true;
    const posledna = e.lastElementChild;
    return (
      !!posledna &&
      posledna.getBoundingClientRect().bottom > e.getBoundingClientRect().bottom + 1
    );
  });

/** časti jedla zhora nadol, ktoré musia byť v riadku mriežky na rovnakej výške */
const CASTI_JEDLA = [".name", ".name-en", ".desc", ".desc-en", ".meta--alg"];

/**
 * Súmerná mriežka ramenov (len bez fotiek): v každom riadku má jedlo vľavo
 * aj vpravo každú časť — názov, preklad, popis, anglický popis, kalórie
 * s alergénmi — rovnako vysokú, takže všetko začína na tej istej výške
 * a štítky sú pod tým. Keď jednému jedlu časť chýba, drží jej miesto prázdny
 * prvok; keď ju nemá ani jedno, skryje sa. S fotkami sa len zruší, čo tu
 * ostalo z režimu bez fotiek.
 */
function zarovnajRiadky(el: HTMLElement, zarovnaj: boolean) {
  const jedla = [...el.children].filter((c): c is HTMLElement =>
    c.classList.contains("dish"),
  );
  for (const d of jedla) {
    for (const sel of CASTI_JEDLA) {
      const e = d.querySelector<HTMLElement>(sel);
      e?.style.removeProperty("min-height");
      e?.classList.remove("prazdne--skryte");
    }
  }
  if (!zarovnaj) return;

  const riadky = new Map<string, HTMLElement[]>();
  for (const d of jedla) {
    const r = d.style.gridRow;
    riadky.set(r, [...(riadky.get(r) ?? []), d]);
  }
  // Zhora nadol: výška časti sa meria až po zarovnaní tých nad ňou.
  for (const skupina of riadky.values()) {
    for (const sel of CASTI_JEDLA) {
      const casti = skupina
        .map((d) => d.querySelector<HTMLElement>(sel))
        .filter((e): e is HTMLElement => !!e);
      const skutocne = casti.filter((e) => !e.classList.contains("prazdne"));
      if (!skutocne.length) {
        for (const e of casti) e.classList.add("prazdne--skryte");
        continue;
      }
      const vyska = Math.max(...skutocne.map((e) => e.getBoundingClientRect().height));
      for (const e of casti) e.style.setProperty("min-height", `${vyska}px`);
    }
  }
}

function useDenseGrid(
  signature: string,
  maxFit = 1,
  /** dostane výslednú mierku stredného bloku (v hustej sadzbe 1) */
  naFit?: (fit: number) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const naFitRef = useRef(naFit);
  naFitRef.current = naFit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /** anglický popis a štítky pri aktuálnej mierke `--fit` */
    const sadzba = () => {
      // 1) Anglický popis čo najväčší, ale stále CELÝ (najviac 3 riadky).
      //    Nezvolíme veľkosť natvrdo: keď klient popis predĺži, doska sa
      //    sama stiahne, namiesto toho aby preklad odsekla.
      let v = MAX_DESC_EN;
      el.style.setProperty("--desc-en", `${v}vh`);
      while (v > MIN_DESC_EN && orezane(el, ".desc-en")) {
        v = Math.round((v - 0.03) * 100) / 100;
        el.style.setProperty("--desc-en", `${v}vh`);
      }

      // Súmerná mriežka — časti jedla sa menia s písmom, preto pri každej
      // mierke, a až keď je známa veľkosť anglického popisu.
      zarovnajRiadky(el, maxFit > 1);

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
        m.style.removeProperty("--tag-fit");

        // Preklad ostáva vždy — zmenší sa celý štítok aj s ním.
        zmensuj(MIN_TAG_FIT);

        // Posledná záchrana pri nezmyselnom počte — zalomiť je lepšie než odseknúť.
        if (pretecie()) m.style.flexWrap = "wrap";
      }
    };

    const meraj = () => {
      el.classList.remove("dense"); // vždy meriame v normálnom režime

      // Riadky mriežky sa riadia obsahom (viď globals.css), takže sa nepýtame,
      // či sa jedlo zmestí do slotu, ale či sa celá mriežka zmestí do svojej
      // výšky — vysoké jedlo si miesto požičia od riadkov s rezervou.
      const zmesti = () => {
        const spodok = el.getBoundingClientRect().bottom;
        return (
          ![...el.children].some((c) => c.getBoundingClientRect().bottom > spodok + 1) &&
          !orezane(el, ".desc") &&
          !orezane(el, ".desc-en")
        );
      };

      // 3) Až potom výška — písmo aj štítky ju ovplyvňujú. Keď sa mriežka
      //    nezmestí, najprv po kúskoch zmenšíme písmo a popisy ostanú CELÉ.
      //    Hustá sadzba, ktorá popisy skracuje na 2 + 1 riadok s „…", je až
      //    posledná možnosť. Predtým sa zapínala hneď — jeden dlhší názov tak
      //    skrátil popisy všetkým ôsmim ramenom naraz.
      //
      //    Hľadá sa hrubo (po 0,1) a potom jemne nahor (po 0,01) — bez fotiek
      //    sa začína na 1,5 a krok po kroku by to bolo vyše 30 premeraní
      //    celej dosky, čo by slabší procesor televízora citeľne zdržalo.
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const skus = (f: number) => {
        el.style.setProperty("--fit", String(f));
        sadzba();
        return zmesti();
      };
      let dobra: number | null = null;
      for (let f = maxFit; f > MIN_FIT; f = r2(f - 0.1)) {
        if (skus(f)) {
          dobra = f;
          break;
        }
      }
      if (dobra === null && skus(MIN_FIT)) dobra = MIN_FIT;
      if (dobra !== null) {
        let najlepsia = dobra;
        for (let f = r2(dobra + 0.01); f < dobra + 0.1 && f <= maxFit; f = r2(f + 0.01)) {
          if (!skus(f)) break;
          najlepsia = f;
        }
        if (najlepsia !== dobra || !zmesti()) skus(najlepsia);
        naFitRef.current?.(najlepsia);
        return;
      }

      el.style.setProperty("--fit", "1");
      sadzba();
      el.classList.add("dense");
      naFitRef.current?.(1);
    };
    meraj();
    document.fonts?.ready.then(meraj).catch(() => {});
    window.addEventListener("resize", meraj);
    return () => window.removeEventListener("resize", meraj);
  }, [signature, maxFit]);
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

export default function Board({
  initial,
  fotky = false,
}: {
  initial: MenuData;
  /**
   * Fotky jedál v strednom bloku. Klient sa rozhodol pre dosku bez nich —
   * texty boli na TV primalé — takže predvolene sú vypnuté a uvoľnené miesto
   * ide na väčšie písmo. Zapnúť sa dajú v adminovi pri obrazovke.
   */
  fotky?: boolean;
}) {
  const [data, setData] = useState<MenuData>(initial);
  /** mierka písma, na ktorej sa ustálil stredný blok */
  const [fitStred, setFitStred] = useState(1);
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

  // Pri zmene obsahu sa sadzba prepočíta. Patria sem aj TEXTY: keď klient
  // v ChoiceQR predĺži názov alebo popis, živé obnovenie musí dosku premerať,
  // inak by nový text pretiekol do susedného slotu až do reštartu TV.
  const texty = (d: Dish) =>
    [d.name, d.nameEn, d.parts.join(","), d.partsEn.join(",")].join("/");
  const sig = (gs: Group[]) =>
    gs
      .map((g) => g.name + ":" + g.dishes.map((d) => d.id + texty(d)).join(","))
      .join("|");
  /* 8 ramenov -> 4+4, 7 -> 4+3, 6 -> 3+3, 5 -> 3+2 … presne ako to chce klient */
  const rows = Math.ceil((data.main?.dishes.length ?? 0) / 2) || 1;
  const volbaNazovEn = (g: OptionGroup) =>
    g.nameEn && g.nameEn.trim().toLowerCase() !== g.name.trim().toLowerCase()
      ? g.nameEn.trim()
      : undefined;
  const mainRef = useDenseGrid(
    (data.main?.dishes ?? [])
      .map((d) => `${d.id}${d.available ? "" : "!"}${d.labels.length}${texty(d)}`)
      .join(",") + (fotky ? "|fotky" : ""),
    fotky ? 1 : MAX_FIT_BEZ_FOTIEK,
    setFitStred,
  );
  // Chuťovky a dětské jídlo nesmú byť väčšie než rameny — tie sú to hlavné.
  // Krajné stĺpce majú základné písmo menšie v pomere ~1 : 1,19 (názov
  // 1,8 vs 2,15vh, popis 1,36 vs 1,62vh), takže pri tejto hranici vyjdú
  // najviac rovnako veľké ako stred.
  const krajMax = fotky
    ? 1
    : Math.min(MAX_FIT_KRAJ_BEZ_FOTIEK, Math.round(fitStred * 1.19 * 100) / 100);
  const leftSig = sig(data.left);
  const rightSig =
    sig(data.right) +
    "|" +
    [...data.choices, ...data.extras].map((g) => g.items.length).join(",");

  const c = data.currency;
  const bg = data.place.background;

  return (
    <div className={`board${fotky ? "" : " board--bez-fotiek"}`}>
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
        <FitColumn signature={leftSig} maxFit={krajMax}>
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
                {/* Pozícia je daná napevno: prvých `rows` jedál ide do ľavej
                    polovice, zvyšok do pravej. Mriežka má vždy `--slot-rows`
                    riadkov, takže pri menšom počte jedál ostanú prázdne
                    riadky dole a jedlá sa nepohnú. */}
                {data.main.dishes.map((d, i) => (
                  <DishRow
                    key={d.id}
                    d={d}
                    currency={c}
                    noPhoto={!fotky}
                    style={{
                      gridColumn: i < rows ? 1 : 2,
                      gridRow: (i % rows) + 1,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* 4 — pravý krajný stĺpec + přídavky dole (tiež sa prispôsobí) */}
        <FitColumn signature={rightSig} maxFit={krajMax}>
          {data.right.map((g, i) => (
            <CategoryBlock key={g.id} group={g} currency={c} sub={i > 0} />
          ))}

          <div className="addons">
            {/* povinné voľby (napr. výber nudlí) — vlastná sekcia NAD prídavkami */}
            {data.choices.map((g) => (
              <OptionBox
                key={g.id}
                title={g.name}
                titleEn={volbaNazovEn(g)}
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
