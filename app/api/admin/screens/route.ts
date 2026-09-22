import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { normalizeSlug } from "@/lib/storage/slug";
import { isLoggedIn } from "@/lib/session";
import { DuplicateSlugError, NotFoundError } from "@/lib/storage/types";
import type { Orientation } from "@/lib/storage/types";

export async function GET() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  return NextResponse.json(await getStore().listScreens());
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    orientation?: Orientation;
  };

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Názov nesmie byť prázdny" }, { status: 400 });
  }

  const slug = normalizeSlug(name);
  if (!slug) {
    return NextResponse.json(
      { error: "Z názvu sa nedá urobiť adresa — použi písmená alebo číslice" },
      { status: 400 },
    );
  }

  const orientation: Orientation =
    body.orientation === "portrait" ? "portrait" : "landscape";

  try {
    return NextResponse.json(
      await getStore().createScreen({ name, slug, orientation }),
      { status: 201 },
    );
  } catch (e) {
    // Stav určuje trieda chyby, nie znenie hlášky — text sa môže zmeniť,
    // trieda je záväzná pre každú implementáciu úložiska.
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof DuplicateSlugError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Obrazovku sa nepodarilo založiť" },
      { status: 500 },
    );
  }
}
