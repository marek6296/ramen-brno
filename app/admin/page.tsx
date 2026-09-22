import { redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { getSlideStore } from "@/lib/slides";
import { isLoggedIn } from "@/lib/session";
import ScreensList from "./screens-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");

  // Slidy sú tu len na pomenovanie dlaždíc v náhľade sledu. Keby ich
  // načítanie zlyhalo, zoznam obrazoviek musí fungovať ďalej.
  const slidy = await getSlideStore()
    .listSlides()
    .catch(() => []);

  return <ScreensList initial={await getStore().listScreens()} slidy={slidy} />;
}
