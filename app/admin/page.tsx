import { redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import ScreensList from "./screens-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");
  return <ScreensList initial={await getStore().listScreens()} />;
}
