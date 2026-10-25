const cards = [
  { title: "Dokumente", hint: "Upload folgt in Meilenstein 2" },
  { title: "Offene Aufgaben", hint: "Aufgaben folgen in Meilenstein 4" },
  { title: "Anstehende Fristen", hint: "Bestätigte Fristen folgen in Meilenstein 4" },
];

export default function DashboardPage() {
  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Übersicht</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <section key={c.title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm text-slate-500">{c.title}</h2>
            <p className="mt-1 text-3xl font-semibold">0</p>
            <p className="mt-2 text-xs text-slate-500">{c.hint}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
