"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Group, Label, MenuData, OptionGroup } from "@/lib/menu";
import "./board-portrait.css";

/**
 * DOSKA NA VÝŠKU (9:16) — pre dve nové televízory otočené na výšku.
 *
 * ZÁMERNÁ KÓPIA, NIE NEDOPATRENIE
 * -------------------------------
 * Štítky, ingrediencie, riadok jedla aj boxy s prídavkami sú tu odpísané
 * z `app/board.tsx`, hoci sú takmer rovnaké. Dôvod je prevádzkový: na `main`
 * beží doska na šírku klientovi v ostrej prevádzke a `app/board.tsx`
 * ani `app/globals.css` sa NESMÚ dotknúť — stráži to `tests/produkcia.test.ts`.
 * Keby sme si odtiaľ čokoľvek vyexportovali, každá budúca úprava dosky na výšku
 * by mohla zhodiť tú, ktorá práve visí v reštaurácii. Duplicita je lacnejšia
 * než výpadok menu v prevádzke.
 *
 * Z toho istého dôvodu má vlastné CSS (`board-portrait.css`) a všetky triedy
 * prefix `bp-` — `globals.css` platí aj na tejto stránke a nesmie sa nám
 * do rozloženia miešať.
 *
 * Čo doska na výšku robí inak než tá na šírku:
 *   - sekcie idú pod sebou, vnútri každej sú jedlá v dvoch stĺpcoch
 *   - ŽIADNE fotky jedál — na výšku na ne nie je miesto (rovnako ako
 *     v krajných stĺpcoch na šírku)
 *   - fullscreen tlačidlo ani skrývanie kurzora tu nie sú, to rieši
 *     prehrávač okolo (`app/tv/[slug]/player.tsx`)
 */

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
 * Všetky značky, ktoré ChoiceQR pozná — mapa aj poradie sú ZÁMERNE presne tie
 * isté ako v `board.tsx`, nech je jedlo na oboch doskách označené rovnako.
 * Keď sa niekedy zmenia tam, musia sa zmeniť aj tu.
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

/** Triedy z `LABELS` sú bez prefixu (kvôli zhode s `board.tsx`) — doplníme ho tu. */
const bp = (cls: string) =>
  cls
    .split(" ")
    .filter(Boolean)
    .map((c) => `bp-${c}`)
    .join(" ");

function Stitky({ labels }: { labels: Label[] }) {
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
        <span key={l.cz} className={`bp-stitok ${bp(l.cls)}`}>
          {l.cz}
          {l.en && <span className="bp-stitok__en"> / {l.en}</span>}
        </span>
      ))}
    </>
  );
}

/**
 * Popis ako zoznam ingrediencií. Každý kus je vlastný inline-block, takže sa
 * NIKDY nezlomí vnútri ("čajové vejce" ostane pokope) a riadok končí čiarkou.
 */
function Zlozky({ parts, className }: { parts: string[]; className: string }) {
  if (!parts.length) return null;
  return (
    <p className={className}>
      {parts.map((p, i) => (
        <span className="bp-zlozka" key={i}>
          {p}
          {i < parts.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}

/**
 * Riadok jedla. Bez fotky — na výšku na ňu nie je miesto.
 * Vypredané jedlo dostane triedu `out`: stlmí sa a názov aj cena sa prečiarknu,
 * presne ako na doske na šírku. Vlastný štítok „vypredané" tu zámerne nie je —
 * pribudol by štvrtý prvok do riadka štítkov a jedlo by prerástlo svoj slot.
 */
function Jedlo({ d, currency }: { d: Dish; currency: string }) {
  const out = !d.available;
  return (
    <article className={`bp-jedlo${out ? " out" : ""}`}>
      <h3 className="bp-nazov">{d.name}</h3>
      <div className="bp-cena">
        {d.price}
        <small>{currency}</small>
      </div>
      {d.nameEn && d.nameEn.toLowerCase() !== d.name.toLowerCase() && (
        <div className="bp-nazov-en">{d.nameEn}</div>
      )}
      <Zlozky parts={d.parts} className="bp-popis" />
      <Zlozky parts={d.partsEn} className="bp-popis-en" />
      {/* 1. riadok: len štítky (Doporučujeme, Novinka, Pálivé, …) */}
      {d.labels.length > 0 && (
        <div className="bp-stitky">
          <Stitky labels={d.labels} />
        </div>
      )}
      {/* 2. riadok: kalórie a alergény vždy spolu a vždy zvlášť — inak sa raz
          zalomia a raz nie, podľa toho, koľko štítkov je nad nimi */}
      {(d.kcal || d.allergens.length > 0) && (
        <div className="bp-stitky bp-stitky--alg">
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
function BoxVolieb({
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
    <div className={`bp-box${variant === "choice" ? " bp-box--volba" : ""}`}>
      <h3>{title}</h3>
      {titleEn && <div className="bp-box__en">{titleEn}</div>}
      {usable.map((g) => (
        <div className="bp-box__skupina" key={g.id}>
          {showLabels && <div className="bp-box__label">{g.name}</div>}
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
                  <span className="bp-vodic" />
                  <span className={free ? "bp-p bp-p--vcene" : "bp-p"}>
                    {free ? "v ceně" : `+${i.price} ${currency}`}
                  </span>
                  {(en || free) && (
                    <span className="bp-pol-en">
                      <span>{en}</span>
                      {free && <span className="bp-pol-en__vcene">incl.</span>}
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

/**
 * Nadpis sekcie — názov aj preklad idú z ChoiceQR, nie z kódu.
 * Vpravo je BUĎ anglický názov, ALEBO (keď ho klient nevyplnil alebo je
 * rovnaký) dekoratívna kana. Obe naraz by v riadku bojovali o miesto
 * a preklad je dôležitejší než ozdoba.
 */
function NadpisSekcie({ name, nameEn }: { name: string; nameEn?: string }) {
  const showEn =
    !!nameEn && !!nameEn.trim() && nameEn.trim().toLowerCase() !== name.trim().toLowerCase();
  const kana = showEn ? null : kanaFor(name);
  return (
    <div className="bp-nadpis">
      <h2>{name}</h2>
      {kana && <span className="bp-kana">{kana}</span>}
      {showEn && <span className="bp-en">{nameEn}</span>}
    </div>
  );
}

/**
 * Jedlá do dvoch stĺpcov: najprv sa naplní ľavý zhora nadol, zvyšok ide vpravo.
 * 8 jedál -> 4+4, 7 -> 4+3, 6 -> 3+3, 5 -> 3+2 — rovnako, ako to chce klient
 * na doske na šírku. Pri jedinom jedle ostane jeden stĺpec.
 */
function Stlpce({ dishes, currency }: { dishes: Dish[]; currency: string }) {
  if (!dishes.length) return null;
  if (dishes.length === 1) {
    return (
      <div className="bp-stlpce bp-stlpce--jeden">
        <div className="bp-stlpec">
          <Jedlo d={dishes[0]} currency={currency} />
        </div>
      </div>
    );
  }
  const del = Math.ceil(dishes.length / 2);
  const casti = [dishes.slice(0, del), dishes.slice(del)];
  return (
    <div className="bp-stlpce">
      {casti.map((cast, i) => (
        <div className="bp-stlpec" key={i}>
          {cast.map((d) => (
            <Jedlo key={d.id} d={d} currency={currency} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Hodiny() {
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
  return <span className="bp-hodiny">{t}</span>;
}

/* ---------- prispôsobenie výšky ---------- */

/**
 * Úrovne úspory miesta, od najšetrnejšej — rovnaký princíp ako `FitColumn`
 * na doske na šírku. `spodok` je najmenšia mierka, pri ktorej sme ochotní
 * na danej úrovni ostať; až keď ani tá nestačí, skrátime popisy a skúsime
 * znova od plnej veľkosti. Čitateľný text s kratším popisom je na TV lepší
 * než drobné písmo — a nadovšetko platí, že sa musia zmestiť VŠETKY položky.
 */
const UROVNE = [
  { cz: 3, en: 2, spodok: 0.82 },
  { cz: 2, en: 2, spodok: 0.72 },
  { cz: 2, en: 1, spodok: 0.6 },
  { cz: 1, en: 1, spodok: 0.42 },
];

/**
 * Mierka sa smie aj ZVÄČŠIŤ. Keď klient polovicu jedál vypne, doska by inak
 * ostala hore natlačená a dole prázdna — na televízore cez pol sály je to
 * zbytočne malé písmo. Strop je poistka proti nezmyslu pri jednom jedle.
 */
const STROP = 1.8;

/** Anglický popis: strop a spodok pomeru k základnej mierke, ako v `board.tsx`. */
const MAX_DESC_EN = 1.2;
const MIN_DESC_EN = 1.0;
/** Spodná hranica zmenšovania štítkov; 4 dvojjazyčné sa do nej ešte zmestia. */
const MIN_TAG_FIT = 0.6;

/**
 * Nič sa nesmie odrezať. Namiesto natvrdo zvolených veľkostí odmeriame
 * skutočnú výšku obsahu a po krokoch zmenšujeme mierku (`--bp-fit`), kým sa
 * všetko nezmestí. Beží len pri zmene dát / rozmerov, nie každý snímok —
 * na TV to teda nič nestojí.
 */
function usePrisposobenie(signature: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prisposob = () => {
      const pretecie = () => el.scrollHeight > el.clientHeight + 1;

      for (const u of UROVNE) {
        el.style.setProperty("--bp-cz-lines", String(u.cz));
        el.style.setProperty("--bp-en-lines", String(u.en));
        el.style.setProperty("--bp-fit", "1");

        // 1) Anglický popis čo najväčší, ale stále CELÝ na povolený počet
        //    riadkov. Nezvolíme veľkosť natvrdo: keď klient popis predĺži,
        //    doska sa sama stiahne, namiesto toho aby preklad odsekla.
        //    Hodnota je násobok základnej mierky, takže sa zmenšuje s ňou.
        const orezany = () =>
          [...el.querySelectorAll<HTMLElement>(".bp-popis-en")].some(
            (e) => e.scrollHeight > e.clientHeight + 1,
          );
        let v = MAX_DESC_EN;
        el.style.setProperty("--bp-desc-en", String(v));
        while (v > MIN_DESC_EN && orezany()) {
          v = Math.round((v - 0.03) * 100) / 100;
          el.style.setProperty("--bp-desc-en", String(v));
        }

        // 2) Potom celková výška. Zmenšujeme po malých krokoch, kým sa
        //    obsah nezmestí alebo kým nenarazíme na spodok úrovne.
        let s = 1;
        const nastav = (x: number) => {
          s = Math.round(x * 1000) / 1000;
          el.style.setProperty("--bp-fit", String(s));
        };
        if (pretecie()) {
          while (s > u.spodok && pretecie()) nastav(s - 0.02);
        } else {
          // Zostalo miesto navyše -> zväčšujeme, kým sa ešte zmestí.
          // Posledný krok vždy vraciame späť, lebo práve on obsah pretlačil.
          while (s < STROP && !pretecie()) nastav(s + 0.02);
          if (pretecie()) nastav(s - 0.02);
        }
        if (!pretecie()) break;
      }

      // 3) Nakoniec štítky v ramenoch: musia ostať na JEDNOM riadku. Tretí
      //    štítok by sa inak zalomil, jedlo by narástlo a tlačilo to pod sebou.
      //    Meria sa každý riadok zvlášť — jedlá majú rôzne dlhé štítky,
      //    spoločná veľkosť by zbytočne zmenšila aj tie, čo sa v pohode zmestia.
      //    Výšku to neovplyvní (riadok ostáva jeden), preto až tu.
      for (const m of el.querySelectorAll<HTMLElement>(
        ".bp-sekcia--hlavna .bp-stitky:not(.bp-stitky--alg)",
      )) {
        const siroke = () => m.scrollWidth > m.clientWidth + 1;
        m.style.flexWrap = "";
        // Preklad ostáva vždy — zmenší sa celý štítok aj s ním.
        let t = 1;
        m.style.removeProperty("--bp-tag-fit");
        while (t > MIN_TAG_FIT && siroke()) {
          t = Math.round((t - 0.04) * 100) / 100;
          m.style.setProperty("--bp-tag-fit", String(t));
        }
        // Posledná záchrana pri nezmyselnom počte — zalomiť je lepšie než odseknúť.
        if (siroke()) m.style.flexWrap = "wrap";
      }
    };

    prisposob();
    // písma sa načítajú neskôr a zmenia metriku textu -> prepočítať
    document.fonts?.ready.then(prisposob).catch(() => {});
    window.addEventListener("resize", prisposob);
    return () => window.removeEventListener("resize", prisposob);
  }, [signature]);

  return ref;
}

/* ---------- rozloženie kategórií ---------- */

/**
 * Kategórie berieme DYNAMICKY z dát, nie podľa názvov — klient si ich
 * v ChoiceQR kedykoľvek premenuje. Rozhoduje len to, koľko majú jedál:
 *   - kategórie s viac než dvoma jedlami dostanú vlastnú sekciu na celú
 *     šírku (jedlá v nej idú do dvoch stĺpcov)
 *   - drobné kategórie (1–2 jedlá) sa poskladajú vedľa seba do jedného
 *     riadka dole, nech neplytvajú výškou
 * Keby bolo drobných kategórií priveľa, tie najväčšie z nich idú hore —
 * štyri stĺpce vedľa seba by už boli nečitateľné.
 */
const MAX_DROBNYCH = 3;

function rozdelKategorie(left: Group[], right: Group[]) {
  const vsetky = [...left, ...right];
  const velke = vsetky.filter((g) => g.dishes.length > 2);
  let drobne = vsetky.filter((g) => g.dishes.length <= 2);

  if (drobne.length > MAX_DROBNYCH) {
    const najvacsie = new Set(
      [...drobne]
        .sort((a, b) => b.dishes.length - a.dishes.length)
        .slice(0, drobne.length - MAX_DROBNYCH),
    );
    velke.push(...drobne.filter((g) => najvacsie.has(g)));
    drobne = drobne.filter((g) => !najvacsie.has(g));
  }

  return { velke, drobne };
}

/* ---------- doska ---------- */

export default function BoardPortrait({ initial }: { initial: MenuData }) {
  const [data, setData] = useState<MenuData>(initial);

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
  const { velke, drobne } = rozdelKategorie(data.left, data.right);

  /* Podpis obsahu — jeho zmena spustí prepočet mierky. Je v ňom všetko,
     čo vie zmeniť výšku: jedlá, ich dostupnosť, počet štítkov aj položky
     v boxoch s voľbami. */
  const podpisSkupiny = (g: { name: string; dishes: Dish[] }) =>
    g.name +
    ":" +
    g.dishes
      .map((d) => `${d.id}${d.available ? "" : "!"}${d.labels.length}`)
      .join(",");
  const podpis =
    [...velke, ...drobne, ...(data.main ? [data.main] : [])]
      .map(podpisSkupiny)
      .join("|") +
    "|" +
    [...data.choices, ...data.extras].map((g) => g.items.length).join(",");

  const teloRef = usePrisposobenie(podpis);

  return (
    <div className="bp-doska">
      {bg && (
        <div className="bp-doska__pozadie" style={{ backgroundImage: `url(${bg})` }} />
      )}

      <header className="bp-hlavicka">
        <div className="bp-znacka">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bp-logo" src="/logo.png" alt="Ramen Brno" />
          <span className="bp-znacka__text">
            <span className="bp-kana">ラーメン</span>
            <span className="bp-podnadpis">Václavská · Brno</span>
          </span>
        </div>
        <span className="bp-nazov-menu">
          MENU<span className="bp-kana"> メニュー</span>
        </span>
        <div className="bp-vpravo">
          {/* klient nechce v hlavičke signalizáciu otvorené/zavreté — len hodiny */}
          {data.workTime && (
            <span className="bp-otvaracka">
              {data.workTime.from.slice(0, 5)}–{data.workTime.till.slice(0, 5)}
            </span>
          )}
          <Hodiny />
        </div>
      </header>

      <main className="bp-telo" ref={teloRef}>
        {/* 1 — väčšie vedľajšie kategórie (u klienta CHUŤOVKY), každá vlastná sekcia */}
        {velke.map((g) => (
          <section className="bp-sekcia" key={g.id}>
            <NadpisSekcie name={g.name} nameEn={g.nameEn} />
            <Stlpce dishes={g.dishes} currency={c} />
          </section>
        ))}

        {/* 2 — najväčšia kategória (u klienta RAMEN): jeden nadpis, dva stĺpce */}
        {data.main && data.main.dishes.length > 0 && (
          <section className="bp-sekcia bp-sekcia--hlavna">
            <NadpisSekcie name={data.main.name} nameEn={data.main.nameEn} />
            <Stlpce dishes={data.main.dishes} currency={c} />
          </section>
        )}

        {/* 3 — drobné kategórie vedľa seba (u klienta DĚTSKÉ JÍDLO │ DEZERT) */}
        {drobne.length > 0 && (
          <section className="bp-sekcia bp-riadok">
            {drobne.map((g) => (
              <div className="bp-bunka" key={g.id}>
                <NadpisSekcie name={g.name} nameEn={g.nameEn} />
                <div className="bp-stlpce bp-stlpce--jeden">
                  <div className="bp-stlpec">
                    {g.dishes.map((d) => (
                      <Jedlo key={d.id} d={d} currency={c} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 4 — povinné voľby a prídavky vedľa seba (u klienta NUDLE │ PŘÍDAVKY) */}
        {(data.choices.length > 0 || data.extras.length > 0) && (
          <section className="bp-sekcia bp-riadok bp-riadok--boxy">
            {data.choices.map((g) => (
              <div className="bp-bunka" key={g.id}>
                <BoxVolieb
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
              </div>
            ))}
            {data.extras.length > 0 && (
              <div className="bp-bunka">
                <BoxVolieb
                  title="PŘÍDAVKY"
                  titleEn="Extras — add to any bowl"
                  groups={data.extras}
                  currency={c}
                />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
