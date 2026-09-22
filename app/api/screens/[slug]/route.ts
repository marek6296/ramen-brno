import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { getSlideStore } from "@/lib/slides";

export const dynamic = "force-dynamic";

/**
 * Nastavenia obrazovky pre TV vrátane slidov, ktoré jej sled používa.
 * Verejné a len na čítanie — TV sa neprihlasuje.
 *
 * Slidy chodia spolu s obrazovkou zámerne: televízor si vystačí s jedným
 * dopytom a úprava slidu sa naň dostane tým istým 15-sekundovým dopytom,
 * ktorý už beží kvôli nastaveniam.
 *
 * Bez cache, inak by sa zmena z adminu na TV prejavila neskoro alebo vôbec.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const screen = await getStore().getScreenBySlug(slug);
  if (!screen) {
    return NextResponse.json({ error: "Obrazovka neexistuje" }, { status: 404 });
  }

  const ids = screen.items
    .filter((i) => i.kind === "slide" && i.slideId)
    .map((i) => i.slideId);
  const slides = Object.fromEntries(
    (await getSlideStore().getSlidesByIds(ids)).map((s) => [s.id, s]),
  );

  return NextResponse.json(
    { screen, slides },
    { headers: { "cache-control": "no-store" } },
  );
}
