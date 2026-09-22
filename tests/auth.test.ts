import { describe, it, expect, beforeEach } from "vitest";
import { checkCredentials, signToken, verifyToken } from "@/lib/auth";

beforeEach(() => {
  process.env.ADMIN_USER = "admin";
  process.env.ADMIN_PASSWORD = "tajne-heslo";
  process.env.ADMIN_SECRET = "podpisovy-kluc";
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

  it("token podpísaný iným kľúčom neprejde", () => {
    const t = signToken(Date.now() + 60_000);
    process.env.ADMIN_SECRET = "iny-kluc";
    expect(verifyToken(t)).toBe(false);
  });
});
