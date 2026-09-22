import { notFound } from "next/navigation";
import { getStore } from "@/lib/storage";
import { getSlideStore } from "@/lib/slides";
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

  const ids = screen.items
    .filter((i) => i.kind === "slide" && i.slideId)
    .map((i) => i.slideId);
  const slides = Object.fromEntries(
    (await getSlideStore().getSlidesByIds(ids)).map((s) => [s.id, s]),
  );

  return <Player initial={screen} initialSlides={slides} />;
}
