import "./admin.css";

export const metadata = { title: "Správa obrazoviek" };

/**
 * Písma sa načítavajú rovnakým spôsobom ako v koreňovom layoute — cez `<link>`
 * na Google Fonts. React 19 tieto značky sám presunie do `<head>`, takže ich
 * stačí vykresliť tu a na televízor sa nedostanú (admin má vlastný segment).
 *
 * Nadpisy: Bricolage Grotesque · text a ovládanie: Instrument Sans ·
 * adresy TV: DM Mono.
 */
const PISMA =
  "https://fonts.googleapis.com/css2" +
  "?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800" +
  "&family=Instrument+Sans:wght@400;500;600" +
  "&family=DM+Mono:wght@400" +
  "&display=swap";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* `precedence` je to, čo React 19 potrebuje, aby štýl presunul do
          `<head>`. Bez neho by `<link>` zostal v tele a písma by naskočili
          až po prvom vykreslení. */}
      <link href={PISMA} rel="stylesheet" precedence="default" />
      <div className="admin">
        <div className="admin__obal">
          <nav className="admin__nav">
            <a href="/admin">Obrazovky</a>
            <a href="/admin/slides">Slidy</a>
          </nav>
          {children}
        </div>
      </div>
    </>
  );
}
