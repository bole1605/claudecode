import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const notice = error === "forbidden" ? "Dieses Konto ist für FristPilot nicht freigeschaltet." : undefined;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">FristPilot</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Persönlicher Zugang – keine Registrierung.</p>
      <LoginForm notice={notice} />
    </main>
  );
}
