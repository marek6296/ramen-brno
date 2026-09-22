import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { normalizeSlug } from "@/lib/storage/slug";
import { isLoggedIn } from "@/lib/session";
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
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 409 },
    );
  }
}
