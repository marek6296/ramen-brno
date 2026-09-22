import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MS, checkCredentials, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, password } = (await req.json().catch(() => ({}))) as {
    user?: string;
    password?: string;
  };

  if (!checkCredentials(user ?? "", password ?? "")) {
    return NextResponse.json({ error: "Nesprávne meno alebo heslo" }, { status: 401 });
  }

  let token: string;
  try {
    token = signToken(Date.now() + SESSION_MS);
  } catch (e) {
    // Nesprávne nastavené prostredie nesmie skončiť záhadnou chybou —
    // prevádzkar musí z hlášky vedieť, čo presne doplniť.
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
