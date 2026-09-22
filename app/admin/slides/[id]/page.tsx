import { notFound, redirect } from "next/navigation";
import { getSlideStore } from "@/lib/slides";
import { getMenu } from "@/lib/menu";
import { isLoggedIn } from "@/lib/session";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function SlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const { id } = await params;
  const slide = await getSlideStore().getSlide(id);
  if (!slide) notFound();

  // Menu berieme na serveri, nech je náhľad hneď a s naozaj živými cenami.
  // Keď ChoiceQR práve neodpovedá, editor musí fungovať aj bez neho.
  let menu = null;
  try {
    menu = await getMenu();
  } catch {
    menu = null;
  }

  return <Editor slide={slide} menu={menu} />;
}
