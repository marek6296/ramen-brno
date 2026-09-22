import { Fragment, type CSSProperties } from "react";

/**
 * Blok nadpisu: hlavný riadok a pod ním anglický preklad. Drží ich POKOPE
 * v jednom prvku `.slide__hlava`, a to je celý zmysel tohto komponentu.
 *
 * Animácie nadpisu totiž musia chytiť obe verzie naraz. Keď mierili na
 * samotný nadpis, pulzoval len český riadok a anglický stál — a linka
 * podčiarknutia sa kreslila medzi ne, teda cez angličtinu. Odkedy je nad
 * nimi spoločný prvok, animácia hýbe blokom ako celkom a podčiarknutie
 * sedí pod oboma riadkami.
 *
 * `rozdelit` rozloží OBA riadky na jednotlivé písmená pre animáciu vlny;
 * počítadlo `--z` beží naprieč nimi, takže vlna plynule prejde z českého
 * riadka do anglického. Bez vlny sa nedelí nič a text ostáva obyčajný.
 */
export default function Hlava({
  text,
  textEn,
  trieda,
  triedaEn,
  rozdelit,
  style,
}: {
  text: string;
  textEn?: string;
  trieda: string;
  triedaEn: string;
  rozdelit: boolean;
  style?: CSSProperties;
}) {
  /* Spoločné počítadlo písmen pre oba riadky — preto ho drží tento blok
     a nie každý riadok zvlášť. */
  const poradie = { hodnota: 0 };

  return (
    <div className="slide__hlava" style={style}>
      <div className={trieda}>{riadok(text, rozdelit, poradie)}</div>
      {textEn ? (
        <div className={triedaEn}>{riadok(textEn, rozdelit, poradie)}</div>
      ) : null}
    </div>
  );
}

/**
 * Text rozložený na slová a až v nich na písmená. Delenie po slovách je
 * nutné: keby boli písmená priamo v riadku, prehliadač by dlhý nadpis
 * zalomil uprostred slova.
 */
function riadok(text: string, rozdelit: boolean, poradie: { hodnota: number }) {
  if (!rozdelit) return text;

  const slova = text.split(" ");
  return slova.map((slovo, i) => (
    <Fragment key={i}>
      <span className="slide__slovo">
        {[...slovo].map((pismeno, j) => (
          <span
            className="slide__pismeno"
            style={{ "--z": poradie.hodnota++ } as CSSProperties}
            key={j}
          >
            {pismeno}
          </span>
        ))}
      </span>
      {/* medzera ako obyčajný text, aby sa nadpis vedel zalomiť medzi slovami */}
      {i < slova.length - 1 ? " " : null}
    </Fragment>
  ));
}
