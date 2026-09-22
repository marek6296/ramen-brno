import type { CSSProperties } from "react";
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
        <div style={dalsie()}>
          <div className="slide__odkaz">{f.text}</div>
          {f.textEn && <div className="slide__odkaz-en">{f.textEn}</div>}
        </div>
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
