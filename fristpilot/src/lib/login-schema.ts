import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(1, "Bitte das Passwort eingeben.").max(256),
});

export type LoginResult = { error: string } | undefined;
