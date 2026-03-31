import { lazy, Suspense } from "react";

const PdfFormViewer = lazy(() =>
  import("./components/PdfFormViewer").then((m) => ({
    default: m.PdfFormViewer,
  })),
);

function App() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-6 py-8">
      <header className="mb-8 flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-[0_8px_24px_rgba(99,102,241,0.35)]" />
        <div>
          <h1 className="m-0 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            FormFlow
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">
            PDF editor with custom text overlay engine
          </p>
        </div>
      </header>

      <main className="flex-1">
        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          aria-label="PDF form preview"
        >
          <Suspense
            fallback={
              <p className="m-0 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading PDF viewer...
              </p>
            }
          >
            <PdfFormViewer pdfUrl="/agreement.pdf" />
          </Suspense>
        </section>
      </main>

      <footer className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>Development: Vite · React · TypeScript · PDF.js · Tailwind</span>
      </footer>
    </div>
  );
}

export default App;
