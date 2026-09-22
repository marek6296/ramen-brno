import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/storage";
import { isLoggedIn } from "@/lib/session";
import { DEMO_SLIDES } from "@/lib/slides";
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
  return <Editor screen={screen} slides={DEMO_SLIDES} />;
}
