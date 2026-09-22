import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tv_admin";
/** ako dlho platí prihlásenie */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function rovnake(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual padá na rôznych dĺžkach, preto ich najprv porovnáme
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Údaje sú v premenných prostredia, nie v databáze — admin tým pádom funguje
 * aj predtým, než k nemu pripojíme Supabase.
 */
export function checkCredentials(user: string, password: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  return rovnake(user, u) && rovnake(password, p);
}

/** Kratšie tajomstvo sa dá uhádnuť hrubou silou, tak ho ani nepustíme ďalej. */
const MIN_DLZKA_TAJOMSTVA = 24;

/**
 * POZOR, toto je bezpečnostne kľúčové: pôvodne tu bolo `process.env.ADMIN_SECRET ?? ""`.
 * Keď premenná chýbala (preklep, zabudnutá na Verceli), podpisovalo sa prázdnym
 * kľúčom — takže si hocikto vedel vyrobiť platnú prihlasovaciu cookie. A keďže
 * `checkCredentials` v tom istom stave vracia `false`, prihlásenie nefungovalo
 * a nikoho by nenapadlo, že admin je pritom dokorán. Preto radšej hlasné zlyhanie.
 */
function tajomstvo(): string {
  const s = process.env.ADMIN_SECRET ?? "";
  if (s.length < MIN_DLZKA_TAJOMSTVA) {
    throw new Error(
      `ADMIN_SECRET chýba alebo je kratšie než ${MIN_DLZKA_TAJOMSTVA} znakov. ` +
        "Bez neho by sa prihlasovacia cookie dala sfalšovať.",
    );
  }
  return s;
}

function podpis(payload: string): string {
  return createHmac("sha256", tajomstvo()).update(payload).digest("base64url");
}

/** token = do kedy platí + podpis, aby sa nedal prepísať */
export function signToken(expiresAtMs: number): string {
  const payload = String(Math.floor(expiresAtMs));
  return `${payload}.${podpis(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let ocakavany: string;
  try {
    ocakavany = podpis(payload);
  } catch {
    // Chýbajúce tajomstvo = nikoho nepustíme. Nikdy nie naopak.
    return false;
  }
  if (!rovnake(sig, ocakavany)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}
