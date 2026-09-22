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

function podpis(payload: string): string {
  const secret = process.env.ADMIN_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
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
  if (!rovnake(sig, podpis(payload))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}
