import { DocumentWorkflow } from "@/components/DocumentWorkflow";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Authorized workflow</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Document Print Utility</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Prepare existing card artwork from an authorized source PDF for physical-card printing. Identity data and source artwork cannot be edited here.
          </p>
        </header>

        <DocumentWorkflow />
      </section>
    </main>
  );
}
