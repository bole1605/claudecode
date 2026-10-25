"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv, isAllowedEmail } from "@/lib/env";
import { loginSchema, type LoginResult } from "@/lib/login-schema";

const GENERIC_ERROR = "Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.";

export async function login(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  // Fremde E-Mails werden gar nicht erst an Supabase weitergereicht.
  if (!isAllowedEmail(parsed.data.email, getServerEnv().ALLOWED_USER_EMAIL)) {
    return { error: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: GENERIC_ERROR };

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
