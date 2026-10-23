import { ManualIdGenerator } from "@/components/ManualIdGenerator";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-teal-400 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            Template 3 (Minimal) Generator
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ethiopian National ID Card Generator
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Fill demographic details in English and Amharic to instantly render high-resolution (300 DPI) print-ready front and back ID cards using Template 3 (Minimal).
          </p>
        </header>

        <ManualIdGenerator />
      </section>
    </main>
  );
}



