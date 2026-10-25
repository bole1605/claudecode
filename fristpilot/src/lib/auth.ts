import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv, isAllowedEmail } from "@/lib/env";

/**
 * Verbindliche serverseitige Pruefung. getUser() fragt den Auth-Server,
 * statt nur ein Cookie zu lesen. Fremde Konten werden abgemeldet.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (!isAllowedEmail(data.user.email, getServerEnv().ALLOWED_USER_EMAIL)) {
    await supabase.auth.signOut();
    redirect("/login?error=forbidden");
  }
  return { supabase, user: data.user };
}
