export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Kulak
        </h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          AI purchasing agent for small cafés. The agent plans, code enforces the
          spending mandate, PayPal pays.
        </p>
        <p className="text-xs text-neutral-400">
          UI coming in T7. Health check:{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-700">
            /api/health
          </code>
        </p>
      </div>
    </main>
  );
}
