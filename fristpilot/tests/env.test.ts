import { describe, expect, it } from "vitest";
import { getServerEnv, isAllowedEmail } from "@/lib/env";
import { loginSchema } from "@/lib/login-schema";
import { isPublicPath } from "@/lib/supabase/proxy";

describe("isAllowedEmail", () => {
  it("vergleicht ohne Gross-/Kleinschreibung und Leerzeichen", () => {
    expect(isAllowedEmail(" Me@Example.com ", "me@example.com")).toBe(true);
  });
  it("lehnt fremde, leere und fehlende Adressen ab", () => {
    expect(isAllowedEmail("other@example.com", "me@example.com")).toBe(false);
    expect(isAllowedEmail("", "me@example.com")).toBe(false);
    expect(isAllowedEmail(undefined, "me@example.com")).toBe(false);
  });
});

describe("getServerEnv", () => {
  it("wirft bei fehlender oder ungueltiger Konfiguration", () => {
    expect(() => getServerEnv({})).toThrow();
    expect(() => getServerEnv({ ALLOWED_USER_EMAIL: "kein-mail" })).toThrow();
  });
  it("akzeptiert gueltige Werte", () => {
    expect(getServerEnv({ ALLOWED_USER_EMAIL: "me@example.com" }).ALLOWED_USER_EMAIL).toBe("me@example.com");
  });
});

describe("loginSchema", () => {
  it("validiert E-Mail und Passwort", () => {
    expect(loginSchema.safeParse({ email: "a@b.de", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.de", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.de", password: "x".repeat(257) }).success).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("gibt nur /login frei", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});
