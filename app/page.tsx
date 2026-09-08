import Board from "./board";
import { getMenu } from "@/lib/menu";

export const revalidate = 60;

export default async function Page() {
  try {
    const data = await getMenu();
    return <Board initial={data} />;
  } catch (e) {
    return (
      <div className="center">
        Menu se načítá — {String(e instanceof Error ? e.message : e)}
      </div>
    );
  }
}
