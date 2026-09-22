import type { CSSProperties } from "react";
import { najdiJedla } from "@/lib/slides/jedla";
import type { MenuData } from "@/lib/menu";
import type { FieldsAkcia, Slide } from "@/lib/slides/types";

/**
 * Akcia: nadpis, jedlá zo živého ChoiceQR a voliteľná zľavnená cena.
 * Bežná cena sa ťahá z menu, zľavnenú píše klient — ChoiceQR ju nepozná.
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
  const jedla = najdiJedla(menu, f.dishIds);
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as CSSProperties;

  return (
    <div className="slide__telo">
      {f.nadpis && (
        <div style={dalsie()}>
          <div className="slide__nadpis">{f.nadpis}</div>
          {f.nadpisEn && <div className="slide__nadpis-en">{f.nadpisEn}</div>}
        </div>
      )}

      {jedla.length > 0 && <div className="slide__linka" style={dalsie()} />}

      {jedla.length > 0 && (
        <div className="slide__jedla" style={dalsie()}>
          {jedla.map((d) => (
            <div className="slide__jedlo" key={d.id}>
              <span className="slide__jedlo-nazov">
                {d.name}
                {d.parts.length > 0 && (
                  <span className="slide__jedlo-popis">{d.parts.join(", ")}</span>
                )}
              </span>
              {f.akciovaCena ? (
                <>
                  <span className="slide__cena slide__cena--stara">
                    {d.price} {currency}
                  </span>
                  <span className="slide__cena">
                    {f.akciovaCena} {currency}
                  </span>
                </>
              ) : (
                <span className="slide__cena">
                  {d.price} {currency}
                </span>
              )}
            </div>
          ))}
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
