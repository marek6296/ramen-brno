import Akcia from "./akcia";
import Uvitanie from "./uvitanie";
import type { MenuData } from "@/lib/menu";
import type { Orientation } from "@/lib/storage/types";
import type { Slide } from "@/lib/slides/types";
import "./slides.css";

/**
 * Rozcestník šablón. TEN ISTÝ komponent kreslí náhľad v adminovi aj obraz na
 * televízore — čo klient vidí pri tvorbe, to naozaj dostane. Preto sa tu
 * nikde nepočíta s výškou okna, len s veľkosťou vlastného kontajnera.
 */
export default function SlideView({
  slide,
  menu,
  orientation,
  currency = "Kč",
}: {
  slide: Slide;
  menu: MenuData | null;
  orientation: Orientation;
  currency?: string;
}) {
  const triedy = [
    "slide",
    `slide--${slide.variant}`,
    `slide--${orientation}`,
    `slide--anim-${slide.animation}`,
  ].join(" ");

  return (
    <div className={triedy}>
      {slide.template === "akcia" ? (
        <Akcia slide={slide} menu={menu} currency={currency} />
      ) : (
        <Uvitanie slide={slide} menu={menu} />
      )}
    </div>
  );
}
