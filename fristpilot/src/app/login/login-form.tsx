"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const message = state?.error ?? notice;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
      </div>
      {message && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{message}</p>}
      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
