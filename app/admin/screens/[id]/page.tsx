import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import { DEMO_SLIDES } from "@/lib/demo-slides";
import { listMedia, mediaJeDostupne } from "@/lib/media";
import { getSlideStore } from "@/lib/slides";
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
  // Slidy sú v editore obrazovky iba ponukou, z čoho vyberať. Keby ich
  // načítanie zlyhalo (tabuľka ešte nevznikla, Supabase má výpadok), nesmie
  // to zhodiť celú stránku — obrazovka sa musí dať upraviť aj bez nich.
  // Rovnako to má vedľa aj `listMedia`.
  const slidyZoznam = await getSlideStore()
    .listSlides()
    .catch(() => []);

  return (
    <Editor
      screen={screen}
      slides={DEMO_SLIDES}
      slidy={slidyZoznam}
      media={media}
      mediaDostupne={dostupne}
    />
  );
}
