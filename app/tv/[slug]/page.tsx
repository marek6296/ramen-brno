import { notFound } from "next/navigation";
import { getStore } from "@/lib/storage";
import Player from "./player";

export const dynamic = "force-dynamic";

export default async function TvPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const screen = await getStore().getScreenBySlug(slug);
  if (!screen) notFound();
  return <Player initial={screen} />;
}
