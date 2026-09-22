import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/session";
import {
  deleteMedia,
  jeBezpecnyNazov,
  listMedia,
  mediaJeDostupne,
  uploadMedia,
} from "@/lib/media";

/**
 * Jediná cesta, ktorou sa admin dostane k vlastným médiám.
 *
 * Nahráva sa ZÁMERNE cez túto routu a nie priamo z prehliadača do Supabase:
 * service role kľúč obchádza RLS, takže zostáva na serveri. Prehliadač pošle
 * súbor sem, kľúč nikdy nevidí.
 */

/** čo bucket pustí — musí sedieť s nastavením bucketu `tv-media` */
const POVOLENE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
] as const;

/** 50 MB, rovnako ako limit bucketu */
const MAX_B = 50 * 1024 * 1024;

const POVOLENE_POPIS = "JPEG, PNG, WebP, SVG a MP4";

function nedostupne() {
  return NextResponse.json(
    { error: "Nahrávanie médií vyžaduje pripojenú databázu" },
    { status: 503 },
  );
}

export async function GET() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  if (!mediaJeDostupne()) return nedostupne();

  try {
    return NextResponse.json(await listMedia());
  } catch {
    return NextResponse.json(
      { error: "Zoznam médií sa nepodarilo načítať" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  if (!mediaJeDostupne()) return nedostupne();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Chýba súbor — pošli ho v poli „file“" },
      { status: 400 },
    );
  }

  // Typ aj veľkosť overujeme aj tu, hoci to kontroluje aj bucket. Odpoveď od
  // Storage je anglická a technická; obsluha v reštaurácii potrebuje vedieť,
  // čo má urobiť inak.
  if (!POVOLENE.includes(file.type as (typeof POVOLENE)[number])) {
    return NextResponse.json(
      {
        error: `Tento formát sa nahrať nedá. Povolené sú ${POVOLENE_POPIS}.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_B) {
    return NextResponse.json(
      {
        error: `Súbor má ${(file.size / 1024 / 1024).toFixed(1)} MB, maximum je 50 MB.`,
      },
      { status: 413 },
    );
  }

  try {
    return NextResponse.json(
      await uploadMedia(file.name, file.type, await file.arrayBuffer()),
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Súbor sa nepodarilo nahrať" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }
  if (!mediaJeDostupne()) return nedostupne();

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path) {
    return NextResponse.json(
      { error: "Chýba názov súboru (?path=)" },
      { status: 400 },
    );
  }
  // Názov prichádza z prehliadača, takže je to vstup od klienta. Bez tejto
  // kontroly by sa dalo poslať `../` a siahnuť mimo bucketu.
  if (!jeBezpecnyNazov(path)) {
    return NextResponse.json(
      { error: "Neplatný názov súboru" },
      { status: 400 },
    );
  }

  try {
    await deleteMedia(path);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Súbor sa nepodarilo zmazať" },
      { status: 500 },
    );
  }
}
