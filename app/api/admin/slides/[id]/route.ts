import { NextResponse } from "next/server";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import {
  SlideNotFoundError,
  type SlideAnimation,
  type SlidePatch,
  type SlideVariant,
} from "@/lib/slides/types";

type Ctx = { params: Promise<{ id: string }> };

const VARIANTY: SlideVariant[] = ["papier", "tmava", "oranzova"];
const ANIMACIE: SlideAnimation[] = ["ziadna", "nastup", "text", "zoom"];

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SlidePatch;
  const patch: SlidePatch = {};

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (VARIANTY.includes(body.variant as SlideVariant)) patch.variant = body.variant;
  if (ANIMACIE.includes(body.animation as SlideAnimation)) patch.animation = body.animation;
  // `fields` berieme ako celok — tvar stráži šablóna v editore aj typy.
  if (body.fields && typeof body.fields === "object") patch.fields = body.fields;

  try {
    return NextResponse.json(await getSlideStore().updateSlide(id, patch));
  } catch (e) {
    if (e instanceof SlideNotFoundError) {
      return NextResponse.json({ error: "Slide neexistuje" }, { status: 404 });
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
