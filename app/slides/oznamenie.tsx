import type { CSSProperties } from "react";
import Hlava from "./hlava";
import type { FieldsOznamenie, Slide } from "@/lib/slides/types";

/**
 * Oznámenie: krátky odkaz hosťom („Dnes zavřeno", „Platíme jen kartou").
 * Na jedlách nestojí, takže sa nikdy nepreskakuje.
 */
export default function Oznamenie({ slide }: { slide: Slide }) {
  const f = slide.fields as FieldsOznamenie;
  let poradie = 0;
  const dalsie = () => ({ "--poradie": poradie++ }) as CSSProperties;

  return (
    <div className="slide__telo">
      {f.text && (
        <Hlava
          text={f.text}
          textEn={f.textEn}
          trieda="slide__odkaz"
          triedaEn="slide__odkaz-en"
          rozdelit={slide.animation === "vlna"}
          style={dalsie()}
        />
      )}
      {f.podtext && (
        <div style={dalsie()}>
          <div className="slide__linka" />
          <div className="slide__podtext slide__podtext--pod-linkou">{f.podtext}</div>
          {f.podtextEn && <div className="slide__podtext-en">{f.podtextEn}</div>}
        </div>
      )}
    </div>
  );
}
