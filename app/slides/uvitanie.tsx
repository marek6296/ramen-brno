import type { CSSProperties } from "react";
import Hlava from "./hlava";
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
        <Hlava
          text={f.nazov}
          trieda="slide__nadpis"
          triedaEn="slide__nadpis-en"
          rozdelit={slide.animation === "vlna"}
          style={dalsie()}
        />
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
          {/* Zámerne vlastná trieda, nie `slide__nadpis`: inak by animácie
              nadpisu rozhýbali aj otváraciu dobu a na slide by sa hýbali
              dva „nadpisy" naraz. */}
          <div className="slide__hodiny">{hodiny}</div>
        </div>
      )}
    </div>
  );
}
