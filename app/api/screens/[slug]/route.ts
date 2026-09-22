import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Nastavenia obrazovky pre TV. Verejné a len na čítanie — TV sa neprihlasuje.
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
  return NextResponse.json(screen, {
    headers: { "cache-control": "no-store" },
  });
}
