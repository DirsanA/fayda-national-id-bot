import { DocumentWorkflow } from "@/components/DocumentWorkflow";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <header className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Authorized Print Workflow
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Document Print Utility
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
            Prepare existing card artwork from an authorized source PDF for physical ID-1 card printing. Pure client-side transformation maintaining maximum privacy.
          </p>
        </header>

        <DocumentWorkflow />
      </section>
    </main>
  );
}

