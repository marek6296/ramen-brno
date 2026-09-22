"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SlideView from "@/app/slides/slide-view";
import type { Dish, MenuData } from "@/lib/menu";
import type { Orientation } from "@/lib/storage/types";
import {
  ANIMACIE,
  VARIANTY,
  type FieldsAkcia,
  type FieldsUvitanie,
  type Slide,
  type SlideAnimation,
  type SlideVariant,
} from "@/lib/slides/types";

/** Odtlačok stavu — podľa neho vieme, či má klient neuložené zmeny. */
const odtlacok = (s: Pick<Slide, "name" | "variant" | "animation" | "fields">) =>
  JSON.stringify(s);

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

  const jeAkcia = slide.template === "akcia";
  const fa = fields as FieldsAkcia;
  const fu = fields as FieldsUvitanie;
  const uprav = (zmena: Partial<FieldsAkcia & FieldsUvitanie>) =>
    setFields((f) => ({ ...f, ...zmena }) as typeof f);

  function prepniJedlo(id: string) {
    const su = fa.dishIds;
    uprav({ dishIds: su.includes(id) ? su.filter((x) => x !== id) : [...su, id] });
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
        <label>
          Názov slidu (len pre teba)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {jeAkcia ? (
          <>
            <label>
              Nadpis
              <input value={fa.nadpis} onChange={(e) => uprav({ nadpis: e.target.value })} />
            </label>
            <label>
              Nadpis anglicky (nepovinné)
              <input value={fa.nadpisEn} onChange={(e) => uprav({ nadpisEn: e.target.value })} />
            </label>
            <label>
              Akciová cena (nepovinné — bežná sa ťahá z ChoiceQR)
              <input
                value={fa.akciovaCena}
                onChange={(e) => uprav({ akciovaCena: e.target.value })}
                placeholder="napr. 225"
              />
            </label>
            <label>
              Podtext (nepovinné)
              <input value={fa.podtext} onChange={(e) => uprav({ podtext: e.target.value })} />
            </label>
            <label>
              Podtext anglicky (nepovinné)
              <input
                value={fa.podtextEn}
                onChange={(e) => uprav({ podtextEn: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Názov podniku
              <input value={fu.nazov} onChange={(e) => uprav({ nazov: e.target.value })} />
            </label>
            <label>
              Japonská ozdoba (nepovinné)
              <input
                value={fu.kana}
                onChange={(e) => uprav({ kana: e.target.value })}
                placeholder="ラーメン"
              />
            </label>
            <label>
              Podtitul (nepovinné)
              <input value={fu.podtitul} onChange={(e) => uprav({ podtitul: e.target.value })} />
            </label>
            <label>
              Podtitul anglicky (nepovinné)
              <input
                value={fu.podtitulEn}
                onChange={(e) => uprav({ podtitulEn: e.target.value })}
              />
            </label>
            <label className="pole pole--zaskrtavacie">
              <input
                type="checkbox"
                checked={fu.zobrazitHodiny}
                onChange={(e) => uprav({ zobrazitHodiny: e.target.checked })}
                style={{ width: "auto" }}
              />
              Zobraziť otváraciu dobu (ťahá sa živo z ChoiceQR)
            </label>
          </>
        )}
      </div>

      {jeAkcia && (
        <div className="karta">
          <h2>Jedlá zo živého menu</h2>
          <p className="ticho">
            Názov a bežná cena sa ťahajú z ChoiceQR — keď ich tam zmeníš, zmenia
            sa aj tu.
          </p>
          {jedla.length === 0 && <p className="ticho">Menu sa nepodarilo načítať.</p>}
          <div className="jedla-vyber">
            {jedla.map((d) => (
              <button
                key={d.id}
                className={`jedlo-tl${fa.dishIds.includes(d.id) ? " jedlo-tl--vybrane" : ""}`}
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
        <label>
          Farebný variant
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
        </label>
        <label>
          Animácia
          <select
            value={animation}
            onChange={(e) => setAnimation(e.target.value as SlideAnimation)}
          >
            {ANIMACIE.map((a) => (
              <option key={a.hodnota} value={a.hodnota}>
                {a.popis}
              </option>
            ))}
          </select>
        </label>
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
