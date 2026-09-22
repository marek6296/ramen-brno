import type { CSSProperties } from "react";
import { najdiJedla } from "@/lib/slides/jedla";
import type { MenuData } from "@/lib/menu";
import type { FieldsNovinka, Slide } from "@/lib/slides/types";

/**
 * Novinka: štítok a pod ním jedlo zo živého ChoiceQR. Oproti Akcii tu nie je
 * zľavnená cena — ukazuje sa bežná, lebo novinka nie je zľava.
 *
 * Stojí na jedlách, takže keď z menu zmiznú všetky, televízor slide preskočí
 * (rieši `jeSlidePrazdny`).
 */
export default function Novinka({
  slide,
  menu,
  currency,
}: {
  slide: Slide;
  menu: MenuData | null;
  currency: string;
}) {
  const f = slide.fields as FieldsNovinka;
  const jedla = najdiJedla(menu, f.dishIds);
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as CSSProperties;

  return (
    <div className="slide__telo slide__telo--novinka">
      {(f.stitok || f.stitokEn) && (
        <div style={dalsie()}>
          {f.stitok && <span className="slide__stitok">{f.stitok}</span>}
          {f.stitokEn && <div className="slide__stitok-en">{f.stitokEn}</div>}
        </div>
      )}

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
              <span className="slide__cena">
                {d.price} {currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
