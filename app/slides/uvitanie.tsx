import type { CSSProperties } from "react";
import type { MenuData } from "@/lib/menu";
import type { FieldsUvitanie, Slide } from "@/lib/slides/types";

/**
 * Uvítanie: názov podniku, japonská ozdoba, podtitul a voliteľne otváracia
 * doba. Hodiny sa ťahajú živo z ChoiceQR — klient ich nikde neprepisuje.
 */
export default function Uvitanie({
  slide,
  menu,
}: {
  slide: Slide;
  menu: MenuData | null;
}) {
  const f = slide.fields as FieldsUvitanie;
  const hodiny =
    f.zobrazitHodiny && menu?.workTime
      ? `${menu.workTime.from.slice(0, 5)} — ${menu.workTime.till.slice(0, 5)}`
      : null;
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as CSSProperties;

  return (
    <div className="slide__telo">
      {f.nazov && (
        <div className="slide__nadpis" style={dalsie()}>
          {f.nazov}
        </div>
      )}
      {f.kana && (
        <div className="slide__kana" style={dalsie()}>
          {f.kana}
        </div>
      )}
      {f.podtitul && (
        <div style={dalsie()}>
          <div className="slide__podtext">{f.podtitul}</div>
          {f.podtitulEn && <div className="slide__podtext-en">{f.podtitulEn}</div>}
        </div>
      )}
      {hodiny && (
        <div style={dalsie()}>
          <div className="slide__linka" />
          <div className="slide__nadpis" style={{ fontSize: "7cqh", marginTop: "2cqh" }}>
            {hodiny}
          </div>
        </div>
      )}
    </div>
  );
}
