import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-12">
      <header className="flex items-center justify-between py-4">
        <span className="text-lg font-semibold">FristPilot</span>
        <form action={logout} className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-500 sm:inline">{user.email}</span>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            Abmelden
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
