import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyToken } from "./auth";

/** true, keď má návštevník platnú prihlasovaciu cookie */
export async function isLoggedIn(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}
