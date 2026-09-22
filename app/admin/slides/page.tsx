import { redirect } from "next/navigation";
import { getSlideStore } from "@/lib/slides";
import { getMenu } from "@/lib/menu";
import { isLoggedIn } from "@/lib/session";
import SlidesList from "./slides-list";

export const dynamic = "force-dynamic";

export default async function SlidesPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");

  // Menu kvôli náhľadom v zozname — keď ChoiceQR neodpovedá, zoznam musí
  // fungovať aj bez neho.
  let menu = null;
  try {
    menu = await getMenu();
  } catch {
    menu = null;
  }

  return <SlidesList initial={await getSlideStore().listSlides()} menu={menu} />;
}
