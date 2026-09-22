import { NextResponse } from "next/server";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import {
  ANIMACIE_HODNOTY,
  SlideNotFoundError,
  VARIANTY_HODNOTY,
  type SlideAnimation,
  type SlidePatch,
  type SlideVariant,
} from "@/lib/slides/types";

type Ctx = { params: Promise<{ id: string }> };


export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SlidePatch;
  const patch: SlidePatch = {};

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (VARIANTY_HODNOTY.includes(body.variant as SlideVariant)) patch.variant = body.variant;
  if (ANIMACIE_HODNOTY.includes(body.animation as SlideAnimation)) patch.animation = body.animation;
  // `fields` berieme ako celok — tvar stráži šablóna v editore aj typy.
  if (body.fields && typeof body.fields === "object") patch.fields = body.fields;

  try {
    return NextResponse.json(await getSlideStore().updateSlide(id, patch));
  } catch (e) {
    if (e instanceof SlideNotFoundError) {
      return NextResponse.json({ error: "Slide neexistuje" }, { status: 404 });
    }
    /* Databáza stráži zoznam povolených animácií vlastnou kontrolou. Kým
       nie je spustená migrácia `supabase/04-animacie-slidov.sql`, nové
       animácie odmietne — a „Uloženie zlyhalo“ by obsluhe nepovedalo nič. */
    if (/23514/.test(String(e)) && /animation/i.test(String(e))) {
      return NextResponse.json(
        {
          error:
            "Databáza túto animáciu zatiaľ nepozná — treba spustiť migráciu supabase/04-animacie-slidov.sql.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Uloženie zlyhalo" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  await getSlideStore().deleteSlide(id);
  return NextResponse.json({ ok: true });
}
