"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">Etwas ist schiefgelaufen.</p>
      <p className="text-sm">Bitte versuche es erneut. Bleibt der Fehler bestehen, prüfe die Konfiguration.</p>
      <button onClick={reset} className="mt-3 rounded-lg border px-3 py-1.5 text-sm">Erneut versuchen</button>
    </div>
  );
}
