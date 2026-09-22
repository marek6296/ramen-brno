import { NextResponse } from "next/server";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import { SABLONY, type SlideTemplate } from "@/lib/slides/types";

export async function GET() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  return NextResponse.json(await getSlideStore().listSlides());
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    template?: SlideTemplate;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Názov nesmie byť prázdny" }, { status: 400 });
  }
  // Zoznam povolených šablón berieme zo `SABLONY`, aby sa na novú nemuselo
  // myslieť aj tu — inak by ju toto ticho prepísalo na akciu.
  const template: SlideTemplate = SABLONY.some((s) => s.hodnota === body.template)
    ? (body.template as SlideTemplate)
    : "akcia";
  try {
    return NextResponse.json(
      await getSlideStore().createSlide({ name, template }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Slide sa nepodarilo vytvoriť" }, { status: 500 });
  }
}
