import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { checkCredentials, signToken, verifyToken } from "@/lib/auth";

beforeEach(() => {
  process.env.ADMIN_USER = "admin";
  process.env.ADMIN_PASSWORD = "tajne-heslo";
  process.env.ADMIN_SECRET = "dost-dlhy-podpisovy-kluc-na-test";
});

describe("checkCredentials", () => {
  it("pustí správne údaje", () => {
    expect(checkCredentials("admin", "tajne-heslo")).toBe(true);
  });

  it("odmietne zlé heslo", () => {
    expect(checkCredentials("admin", "zle")).toBe(false);
  });

  it("odmietne zlé meno", () => {
    expect(checkCredentials("niekto", "tajne-heslo")).toBe(false);
  });

  it("odmietne, keď heslo nie je nastavené v prostredí", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkCredentials("admin", "")).toBe(false);
  });
});

describe("token", () => {
  it("vlastný podpis prejde", () => {
    expect(verifyToken(signToken(Date.now() + 60_000))).toBe(true);
  });

  it("vypršaný token neprejde", () => {
    expect(verifyToken(signToken(Date.now() - 1))).toBe(false);
  });

  it("prepísaný token neprejde", () => {
    const t = signToken(Date.now() + 60_000);
    expect(verifyToken(t.replace(/.$/, "x"))).toBe(false);
  });

  it("nezmysel neprejde", () => {
    expect(verifyToken("cokolvek")).toBe(false);
    expect(verifyToken("")).toBe(false);
  });

  it("bez ADMIN_SECRET sa token nedá podpísať", () => {
    delete process.env.ADMIN_SECRET;
    expect(() => signToken(Date.now() + 60_000)).toThrow(/ADMIN_SECRET/);
  });

  it("prikrátke ADMIN_SECRET sa odmietne", () => {
    process.env.ADMIN_SECRET = "kratke";
    expect(() => signToken(Date.now() + 60_000)).toThrow(/ADMIN_SECRET/);
  });

  it("bez ADMIN_SECRET neprejde ŽIADEN token — ani sfalšovaný prázdnym kľúčom", () => {
    const platny = signToken(Date.now() + 60_000);
    delete process.env.ADMIN_SECRET;
    expect(verifyToken(platny)).toBe(false);
    // takto si útočník vyrábal cookie, kým sa podpisovalo prázdnym kľúčom
    const payload = String(Date.now() + 60_000);
    const falosny = `${payload}.${createHmac("sha256", "").update(payload).digest("base64url")}`;
    expect(verifyToken(falosny)).toBe(false);
  });

  it("token podpísaný iným kľúčom neprejde", () => {
    const t = signToken(Date.now() + 60_000);
    process.env.ADMIN_SECRET = "uplne-iny-dlhy-podpisovy-kluc";
    expect(verifyToken(t)).toBe(false);
  });
});
