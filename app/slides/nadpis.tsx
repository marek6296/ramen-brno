import { Fragment, type CSSProperties } from "react";

/**
 * Nadpis slidu. Pri animácii „vlniaci sa nadpis" ho treba rozložiť na
 * jednotlivé písmená, aby sa dali rozhýbať po jednom — poradie písmena nesie
 * `--z` a CSS podľa neho posúva začiatok vlny.
 *
 * Delíme najprv na slová a až v nich na písmená. Keby boli písmená priamo
 * v riadku, prehliadač by dlhý nadpis zalomil uprostred slova.
 *
 * Keď sa nedelí, vykreslí sa obyčajný text — na existujúcich slidoch sa tým
 * nemení vôbec nič.
 */
export default function Nadpis({
  text,
  trieda,
  rozdelit,
}: {
  text: string;
  trieda: string;
  rozdelit: boolean;
}) {
  if (!rozdelit) return <div className={trieda}>{text}</div>;

  const slova = text.split(" ");
  let poradie = 0;

  return (
    <div className={trieda}>
      {slova.map((slovo, i) => (
        <Fragment key={i}>
          <span className="slide__slovo">
            {[...slovo].map((pismeno, j) => (
              <span
                className="slide__pismeno"
                style={{ "--z": poradie++ } as CSSProperties}
                key={j}
              >
                {pismeno}
              </span>
            ))}
          </span>
          {/* medzera ako obyčajný text, aby sa nadpis vedel zalomiť medzi slovami */}
          {i < slova.length - 1 ? " " : null}
        </Fragment>
      ))}
    </div>
  );
}
