import { NextResponse } from "next/server";
import { getMenu } from "@/lib/menu";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await getMenu();
    return NextResponse.json(data, {
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 502 }
    );
  }
}
