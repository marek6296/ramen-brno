"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import SlideView from "@/app/slides/slide-view";
import type { Dish, MenuData } from "@/lib/menu";
import type { Orientation } from "@/lib/storage/types";
import {
  ANIMACIE,
  animaciePre,
  VARIANTY,
  polozkyAkcie,
  stojiNaJedlach,
  type FieldsAkcia,
  type FieldsNovinka,
  type FieldsOznamenie,
  type FieldsUvitanie,
  type PolozkaAkcie,
  type Slide,
  type SlideAnimation,
  type SlideFields,
  type SlideVariant,
} from "@/lib/slides/types";

/**
 * Odtlačok stavu — podľa neho vieme, či má klient neuložené zmeny.
 *
 * Zámerne skladáme pole zo štyroch hodnôt, nie `JSON.stringify(objekt)`:
 * do tejto funkcie sa dá podať aj celý `Slide` a vtedy by sa do odtlačku
 * dostali aj `id`, `template` a `updatedAt`. Odtlačok načítaného slidu by
 * sa potom nikdy nezhodol s odtlačkom rozpracovaného a lišta by hlásila
 * neuložené zmeny hneď po otvorení. Takto na tom nezáleží.
 */
const odtlacok = (s: {
  name: string;
  variant: SlideVariant;
  animation: SlideAnimation;
  fields: SlideFields;
}) => JSON.stringify([s.name, s.variant, s.animation, s.fields]);

/**
 * Políčko formulára. Popis nad ním, voliteľná rada pod ním. Klient nie je
 * dizajnér ani technik — keď mu pri políčku nepovieme, načo je, vyplní ho
 * podľa svojho a diví sa, čo mu vyšlo na stene.
 */
function Pole({
  popis,
  rada,
  children,
}: {
  popis: string;
  rada?: string;
  children: ReactNode;
}) {
  return (
    <label className="pole">
      <span className="pole__popis">{popis}</span>
      {children}
      {rada && <span className="pole__rada">{rada}</span>}
    </label>
  );
}

function vsetkyJedla(menu: MenuData | null): Dish[] {
  if (!menu) return [];
  return [
    ...menu.left.flatMap((g) => g.dishes),
    ...(menu.main?.dishes ?? []),
    ...menu.right.flatMap((g) => g.dishes),
  ];
}

export default function Editor({ slide, menu }: { slide: Slide; menu: MenuData | null }) {
  const [name, setName] = useState(slide.name);
  const [variant, setVariant] = useState<SlideVariant>(slide.variant);
  const [animation, setAnimation] = useState<SlideAnimation>(slide.animation);
  const [fields, setFields] = useState(slide.fields);
  const [nahlad, setNahlad] = useState<Orientation>("landscape");
  const [novaVlastna, setNovaVlastna] = useState("");
  const [novaVlastnaEn, setNovaVlastnaEn] = useState("");
  const [ulozeny, setUlozeny] = useState(() => odtlacok(slide));
  const [stav, setStav] = useState("");

  const teraz = odtlacok({ name, variant, animation, fields });
  const zmenene = teraz !== ulozeny;

  /* Náhľad dostáva presne to, čo pôjde na televízor — nie približnú kópiu. */
  const nahladSlide: Slide = { ...slide, name, variant, animation, fields };

  const jedla = useMemo(() => vsetkyJedla(menu), [menu]);

  async function uloz() {
    setStav("Ukladám…");
    const r = await fetch(`/api/admin/slides/${slide.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, variant, animation, fields }),
    });
    if (!r.ok) {
      setStav("Uloženie zlyhalo");
      return;
    }
    setUlozeny(teraz);
    setStav("Uložené — na televízoroch do 15 sekúnd");
  }

  const fa = fields as FieldsAkcia;
  const fu = fields as FieldsUvitanie;
  const fo = fields as FieldsOznamenie;
  const fn = fields as FieldsNovinka;
  /** Akcia aj Novinka stoja na jedlách — obe ukazujú výber z menu. */
  const sJedlami = stojiNaJedlach(slide.template);
  const jeAkcia = slide.template === "akcia";
  /* Akcia má položky, ktoré môžu byť aj vlastný text. Novinka stojí len na
     jedlách z menu, tam stačí zoznam id. */
  const polozky = jeAkcia ? polozkyAkcie(fa) : [];
  const vybrane = jeAkcia
    ? polozky.flatMap((p) => (p.druh === "jedlo" ? [p.dishId] : []))
    : sJedlami
      ? (fields as { dishIds: string[] }).dishIds
      : [];
  const uprav = (
    zmena: Partial<FieldsAkcia & FieldsUvitanie & FieldsOznamenie & FieldsNovinka>,
  ) => setFields((f) => ({ ...f, ...zmena }) as typeof f);

  function prepniJedlo(id: string) {
    if (!jeAkcia) {
      uprav({
        dishIds: vybrane.includes(id)
          ? vybrane.filter((x) => x !== id)
          : [...vybrane, id],
      });
      return;
    }
    const je = polozky.some((p) => p.druh === "jedlo" && p.dishId === id);
    zmenPolozky(
      je
        ? polozky.filter((p) => !(p.druh === "jedlo" && p.dishId === id))
        : [...polozky, { druh: "jedlo", dishId: id }],
    );
  }

  /**
   * Položky sa ukladajú do `polozky`; `dishIds` držíme dorovnané, aby staršia
   * verzia stránky otvorená na inej záložke slide nezobrazila prázdny.
   */
  function zmenPolozky(nove: PolozkaAkcie[]) {
    uprav({
      polozky: nove,
      dishIds: nove.flatMap((p) => (p.druh === "jedlo" ? [p.dishId] : [])),
    });
  }

  function pridajVlastnu() {
    const text = novaVlastna.trim();
    if (!text) return;
    zmenPolozky([...polozky, { druh: "vlastna", text, textEn: novaVlastnaEn.trim() }]);
    setNovaVlastna("");
    setNovaVlastnaEn("");
  }

  return (
    <>
      <header className="hlavicka">
        <div>
          <h1>{slide.name}</h1>
          <p className="hlavicka__popis">ÚPRAVA SLIDU</p>
        </div>
        <Link className="tl tl--ticho" href="/admin/slides">
          ← Slidy
        </Link>
      </header>

      <div className="karta">
        <div className="hlava-karty">
          <h2>Náhľad</h2>
          <div className="akcie">
            <button
              className={`tl ${nahlad === "landscape" ? "tl--hlavne" : "tl--ticho"}`}
              onClick={() => setNahlad("landscape")}
            >
              Na šírku
            </button>
            <button
              className={`tl ${nahlad === "portrait" ? "tl--hlavne" : "tl--ticho"}`}
              onClick={() => setNahlad("portrait")}
            >
              Na výšku
            </button>
          </div>
        </div>
        <div className={`nahlad nahlad--${nahlad}`}>
          <SlideView
            slide={nahladSlide}
            menu={menu}
            orientation={nahlad}
            currency={menu?.currency ?? "Kč"}
          />
        </div>
        {!menu && (
          <p className="ticho">
            ChoiceQR práve neodpovedá — jedlá sa v náhľade nezobrazia, na
            televízore sa doplnia samy.
          </p>
        )}
      </div>

      <div className="karta">
        <h2>Obsah</h2>
        <p className="ticho">
          Čo nevyplníš, to sa na slide neukáže — nezostane po tom prázdne
          miesto. Anglické riadky sú nepovinné.
        </p>

        <Pole popis="Názov slidu" rada="Len pre teba v zozname slidov. Na televízore sa neukáže.">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Pole>

        {slide.template === "akcia" ? (
          <>
            <Pole popis="Nadpis" rada="Veľký text úplne hore, napríklad „AKCE DNE“.">
              <input value={fa.nadpis} onChange={(e) => uprav({ nadpis: e.target.value })} />
            </Pole>
            <Pole popis="Nadpis anglicky">
              <input value={fa.nadpisEn} onChange={(e) => uprav({ nadpisEn: e.target.value })} />
            </Pole>
            <Pole
              popis="Akciová cena"
              rada="Len číslo, napríklad 199. Bežná cena sa vedľa nej preškrtne sama a ťahá sa z ChoiceQR. Keď necháš prázdne, ukáže sa len bežná cena."
            >
              <input
                value={fa.akciovaCena}
                onChange={(e) => uprav({ akciovaCena: e.target.value })}
                placeholder="199"
                inputMode="numeric"
              />
            </Pole>
            <Pole popis="Podtext" rada="Malý riadok pod jedlom, napríklad „do 20:00“.">
              <input value={fa.podtext} onChange={(e) => uprav({ podtext: e.target.value })} />
            </Pole>
            <Pole popis="Podtext anglicky">
              <input value={fa.podtextEn} onChange={(e) => uprav({ podtextEn: e.target.value })} />
            </Pole>
          </>
        ) : slide.template === "uvitanie" ? (
          <>
            <Pole popis="Názov podniku" rada="Veľký text v strede slidu.">
              <input value={fu.nazov} onChange={(e) => uprav({ nazov: e.target.value })} />
            </Pole>
            <Pole popis="Japonská ozdoba" rada="Nepovinné. Malý japonský nápis pod názvom.">
              <input
                value={fu.kana}
                onChange={(e) => uprav({ kana: e.target.value })}
                placeholder="ラーメン"
              />
            </Pole>
            <Pole popis="Podtitul" rada="Napríklad adresa alebo mesto.">
              <input value={fu.podtitul} onChange={(e) => uprav({ podtitul: e.target.value })} />
            </Pole>
            <Pole popis="Podtitul anglicky">
              <input
                value={fu.podtitulEn}
                onChange={(e) => uprav({ podtitulEn: e.target.value })}
              />
            </Pole>
            <label className="pole pole--zaskrtavacie">
              <input
                type="checkbox"
                checked={fu.zobrazitHodiny}
                onChange={(e) => uprav({ zobrazitHodiny: e.target.checked })}
              />
              <span>
                Zobraziť otváraciu dobu
                <span className="pole__rada">
                  Ťahá sa živo z ChoiceQR — keď ju tam zmeníš, zmení sa aj tu.
                </span>
              </span>
            </label>
          </>
        ) : slide.template === "oznamenie" ? (
          <>
            <Pole popis="Odkaz hosťom" rada="Hlavný text cez celý slide, napríklad „Dnes zavřeno“.">
              <input
                value={fo.text}
                onChange={(e) => uprav({ text: e.target.value })}
                placeholder="Dnes zavřeno"
              />
            </Pole>
            <Pole popis="Odkaz anglicky">
              <input value={fo.textEn} onChange={(e) => uprav({ textEn: e.target.value })} />
            </Pole>
            <Pole popis="Podtext" rada="Malý riadok pod odkazom, napríklad „Otevíráme v pátek“.">
              <input value={fo.podtext} onChange={(e) => uprav({ podtext: e.target.value })} />
            </Pole>
            <Pole popis="Podtext anglicky">
              <input
                value={fo.podtextEn}
                onChange={(e) => uprav({ podtextEn: e.target.value })}
              />
            </Pole>
          </>
        ) : (
          <>
            <Pole popis="Štítok" rada="Oranžový odznak nad jedlom.">
              <input
                value={fn.stitok}
                onChange={(e) => uprav({ stitok: e.target.value })}
                placeholder="NOVINKA"
              />
            </Pole>
            <Pole popis="Štítok anglicky">
              <input value={fn.stitokEn} onChange={(e) => uprav({ stitokEn: e.target.value })} />
            </Pole>
            <p className="ticho">
              Názov, popis aj cenu jedla ťahá slide z ChoiceQR. Vyber ho nižšie.
            </p>
          </>
        )}
      </div>

      {sJedlami && (
        <div className="karta">
          <h2>{jeAkcia ? "Položky akcie" : "Jedlá zo živého menu"}</h2>
          <p className="ticho">
            Názov a bežná cena sa ťahajú z ChoiceQR — keď ich tam zmeníš, zmenia
            sa aj tu.
          </p>

          {jeAkcia && (
            <>
              <label className="pole pole--zaskrtavacie">
                <input
                  type="checkbox"
                  checked={!!fa.spojene}
                  onChange={(e) => uprav({ spojene: e.target.checked })}
                />
                <span>
                  Spojiť do jednej ponuky
                  <span className="pole__rada">
                    Napríklad „Ramen + Kola" na jednom riadku a za jednu cenu.
                    Bez zaškrtnutia je každá položka vlastný riadok s vlastnou
                    cenou.
                  </span>
                </span>
              </label>

              {polozky.length > 0 && (
                <ul className="polozky">
                  {polozky.map((p, i) => (
                    <li className="polozky__riadok" key={i}>
                      <span className="polozky__poradie">{i + 1}</span>
                      <span className="polozky__nazov">
                        {p.druh === "vlastna"
                          ? p.text
                          : (jedla.find((d) => d.id === p.dishId)?.name ??
                            "Jedlo už nie je v menu")}
                        {p.druh === "vlastna" && (
                          <span className="polozky__znacka">vlastná</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="tl tl--ticho tl--male"
                        onClick={() => zmenPolozky(polozky.filter((_, j) => j !== i))}
                      >
                        Odobrať
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Pole
                popis="Vlastná položka"
                rada="Pre to, čo v jedálnom lístku nie je — nápoj, dezert, darček. Cenu nemá, tú určuje akciová cena celej ponuky."
              >
                <div className="vlastna">
                  <input
                    type="text"
                    value={novaVlastna}
                    onChange={(e) => setNovaVlastna(e.target.value)}
                    placeholder="napr. Coca-Cola 0,33 l"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        pridajVlastnu();
                      }
                    }}
                  />
                  <input
                    type="text"
                    value={novaVlastnaEn}
                    onChange={(e) => setNovaVlastnaEn(e.target.value)}
                    placeholder="anglicky (nepovinné)"
                  />
                  <button
                    type="button"
                    className="tl tl--tmave tl--male"
                    onClick={pridajVlastnu}
                    disabled={!novaVlastna.trim()}
                  >
                    Pridať
                  </button>
                </div>
              </Pole>
            </>
          )}

          {jedla.length === 0 && <p className="ticho">Menu sa nepodarilo načítať.</p>}
          <p className="pole__popis" style={{ marginTop: "0.9rem" }}>
            {jeAkcia ? "Pridať jedlo z menu" : "Jedlá"}
          </p>
          <div className="jedla-vyber">
            {jedla.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`jedlo-tl${vybrane.includes(d.id) ? " jedlo-tl--vybrane" : ""}`}
                onClick={() => prepniJedlo(d.id)}
              >
                <span>{d.name}</span>
                <span className="ticho">{d.price} Kč</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="karta">
        <h2>Vzhľad</h2>
        <Pole popis="Farebný variant" rada="Tri zladené dvojice farieb z vizuálu podniku.">
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as SlideVariant)}
          >
            {VARIANTY.map((v) => (
              <option key={v.hodnota} value={v.hodnota}>
                {v.popis}
              </option>
            ))}
          </select>
        </Pole>
        <Pole
          popis="Animácia"
          rada="Čo sa deje NA slide, kým je na obrazovke. To, ako slide priletí a odletí, je prechod — ten sa nastavuje pri obrazovke, v slede položiek."
        >
          <select
            value={animation}
            onChange={(e) => setAnimation(e.target.value as SlideAnimation)}
          >
            {animaciePre(slide.template).map((a) => (
              <option key={a.hodnota} value={a.hodnota}>
                {a.popis}
              </option>
            ))}
          </select>
          <span className="pole__rada">
            {ANIMACIE.find((a) => a.hodnota === animation)?.popisDlhy}
          </span>
        </Pole>
      </div>

      <div className="lista">
        <span>{zmenene ? "Neuložené zmeny" : stav || "Všetko uložené"}</span>
        <button className="tl tl--hlavne" onClick={uloz} disabled={!zmenene}>
          Uložiť
        </button>
      </div>
    </>
  );
}
