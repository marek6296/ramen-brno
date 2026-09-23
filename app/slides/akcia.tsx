import { Fragment, type CSSProperties } from "react";
import Hlava from "./hlava";
import { najdiJedla } from "@/lib/slides/jedla";
import type { Dish, MenuData } from "@/lib/menu";
import { polozkyAkcie, type FieldsAkcia, type Slide } from "@/lib/slides/types";

/** Položka akcie pripravená na vykreslenie — jedlo z menu alebo vlastný text. */
type Cast = { nazov: string; nazovEn: string; popis: string[]; cena: number | null };

/**
 * Akcia: nadpis, položky a voliteľná zľavnená cena.
 *
 * Položkou je buď jedlo zo živého ChoiceQR (názov, popis aj bežná cena sa
 * ťahajú odtiaľ), alebo vlastný text — veľa akcií znie „ramen + kola" a kola
 * v jedálnom lístku nie je.
 */
export default function Akcia({
  slide,
  menu,
  currency,
}: {
  slide: Slide;
  menu: MenuData | null;
  currency: string;
}) {
  const f = slide.fields as FieldsAkcia;
  const polozky = polozkyAkcie(f);

  /* Jedlá si vytiahneme naraz a potom priradíme — `najdiJedla` tie, ktoré
     už v menu nie sú, ticho vynechá, takže sa na ne nedá spoľahnúť podľa
     poradia. */
  const podlaId = new Map<string, Dish>(
    najdiJedla(
      menu,
      polozky.map((p) => (p.druh === "jedlo" ? p.dishId : "")),
    ).map((d) => [d.id, d]),
  );

  const casti: Cast[] = polozky
    .map((p): Cast | null => {
      if (p.druh === "vlastna") {
        return p.text.trim()
          ? { nazov: p.text, nazovEn: p.textEn || p.text, popis: [], cena: null }
          : null;
      }
      const d = podlaId.get(p.dishId);
      return d
        ? { nazov: d.name, nazovEn: d.nameEn ?? d.name, popis: d.parts, cena: d.price }
        : null;
    })
    .filter((c): c is Cast => c !== null);

  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as CSSProperties;

  /* Pri spojenej ponuke sčítame bežné ceny — ale LEN keď ju poznáme pri
     každej časti. Inak by preškrtnutá suma klamala: „275 Kč" vedľa „ramen
     + kola za 199" by tvrdilo, že kola je v tých 275 zarátaná. */
  const vsetkyMajuCenu = casti.length > 0 && casti.every((c) => c.cena !== null);
  const suma = vsetkyMajuCenu
    ? casti.reduce((spolu, c) => spolu + (c.cena ?? 0), 0)
    : null;
  const spojene = f.spojene && casti.length > 1;
  const jeInaAnglicky = casti.some((c) => c.nazovEn !== c.nazov);

  return (
    <div className="slide__telo">
      {f.nadpis && (
        <Hlava
          text={f.nadpis}
          textEn={f.nadpisEn}
          trieda="slide__nadpis"
          triedaEn="slide__nadpis-en"
          rozdelit={slide.animation === "vlna"}
          style={dalsie()}
        />
      )}

      {casti.length > 0 && <div className="slide__linka" style={dalsie()} />}

      {casti.length > 0 && (
        <div className="slide__jedla" style={dalsie()}>
          {spojene ? (
            <div className="slide__jedlo">
              <span className="slide__jedlo-nazov">
                {casti.map((c, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="slide__plus">+</span>}
                    {c.nazov}
                  </Fragment>
                ))}
                {jeInaAnglicky && (
                  <span className="slide__jedlo-popis">
                    {casti.map((c) => c.nazovEn).join(" + ")}
                  </span>
                )}
              </span>
              <Cena stara={suma} akciova={f.akciovaCena} currency={currency} />
            </div>
          ) : (
            casti.map((c, i) => (
              <div className="slide__jedlo" key={i}>
                <span className="slide__jedlo-nazov">
                  {c.nazov}
                  {c.popis.length > 0 && (
                    <span className="slide__jedlo-popis">{c.popis.join(", ")}</span>
                  )}
                </span>
                <Cena stara={c.cena} akciova={f.akciovaCena} currency={currency} />
              </div>
            ))
          )}
        </div>
      )}

      {f.podtext && (
        <div style={dalsie()}>
          <div className="slide__podtext">{f.podtext}</div>
          {f.podtextEn && <div className="slide__podtext-en">{f.podtextEn}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Cena položky. Preškrtnutá pôvodná sa ukáže len vtedy, keď ju naozaj
 * poznáme a zároveň je čím ju preškrtnúť — vlastná položka („Coca-Cola")
 * v ChoiceQR cenu nemá.
 */
function Cena({
  stara,
  akciova,
  currency,
}: {
  stara: number | null;
  akciova: string;
  currency: string;
}) {
  if (akciova) {
    return (
      <>
        {stara !== null && (
          <span className="slide__cena slide__cena--stara">
            {stara} {currency}
          </span>
        )}
        <span className="slide__cena">
          {akciova} {currency}
        </span>
      </>
    );
  }
  if (stara === null) return null;
  return (
    <span className="slide__cena">
      {stara} {currency}
    </span>
  );
}
