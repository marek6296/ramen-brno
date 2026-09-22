import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import { DEMO_SLIDES } from "@/lib/slides";
import { listMedia, mediaJeDostupne } from "@/lib/media";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const { id } = await params;
  const screen = await getStore().getScreen(id);
  if (!screen) notFound();

  // Zoznam médií sa ťahá tu na serveri, rovnako ako ukážkové slidy — editor
  // ho tak má hneď pri prvom vykreslení. Výpadok Storage nesmie zhodiť celý
  // editor; obrazovka sa dá upravovať aj bez zoznamu médií.
  const dostupne = mediaJeDostupne();
  const media = dostupne ? await listMedia().catch(() => []) : [];

  return (
    <Editor
      screen={screen}
      slides={DEMO_SLIDES}
      media={media}
      mediaDostupne={dostupne}
    />
  );
}
