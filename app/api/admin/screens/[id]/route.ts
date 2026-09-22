import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import { DuplicateSlugError, NotFoundError } from "@/lib/storage/types";
import type { PlaylistItem, ScreenPatch } from "@/lib/storage/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as ScreenPatch;
  const patch: ScreenPatch = {};

  // Slug sa pri premenovaní ZÁMERNE nemení. TV je fyzicky nastavená na
  // konkrétnu adresu; keby sa zmenila s názvom, obrazovka by zhasla a nikto
  // by netušil prečo. Adresa vzniká raz, pri založení obrazovky.
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }

  if (body.orientation === "portrait" || body.orientation === "landscape") {
    patch.orientation = body.orientation;
  }

  // Otočenie stránky pre TV zavesenú na výšku. Keď pole v tele nie je,
  // ZÁMERNE sa nepatchuje — inak by uloženie samotného sledu potichu zrušilo
  // otočenie. Nezmyselná hodnota z prehliadača padá na „neotáčať".
  if (body.rotation !== undefined) {
    patch.rotation =
      body.rotation === "left" || body.rotation === "right"
        ? body.rotation
        : "none";
  }

  if (Array.isArray(body.items)) {
    patch.items = body.items.map(
      (it: PlaylistItem): PlaylistItem => ({
        id: String(it.id),
        kind: it.kind === "image" || it.kind === "video" ? it.kind : "menu",
        mediaPath: String(it.mediaPath ?? ""),
        // pod 3 s by nikto nestihol prečítať, nad hodinu nemá zmysel
        durationS: Math.min(3600, Math.max(3, Math.round(Number(it.durationS) || 10))),
        // staré položky pole nemajú a z prehliadača môže prísť čokoľvek
        transition: ["fade", "slide", "zoom", "none"].includes(it.transition)
          ? it.transition
          : "fade",
        // Počet prehratí videa. Menej než raz nedáva zmysel a nad 20-krát by
        // sled na tej jednej položke stál prakticky celý deň. Nezmysel
        // (chýbajúce pole, text, desatinné číslo) padá na 1 — pôvodné
        // správanie, klip sa prehrá raz a ide sa ďalej.
        repeats: Math.min(20, Math.max(1, Math.round(Number(it.repeats)) || 1)),
      }),
    );
  }

  try {
    return NextResponse.json(await getStore().updateScreen(id, patch));
  } catch (e) {
    // Stav určuje trieda chyby, nie znenie hlášky — text sa môže zmeniť,
    // trieda je záväzná pre každú implementáciu úložiska.
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof DuplicateSlugError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Obrazovku sa nepodarilo uložiť" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  const { id } = await params;
  await getStore().deleteScreen(id);
  return NextResponse.json({ ok: true });
}
