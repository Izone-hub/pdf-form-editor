import { lazy, Suspense } from 'react'
import './App.css'

const PdfFormViewer = lazy(() =>
  import('./components/PdfFormViewer').then((m) => ({ default: m.PdfFormViewer })),
)

function App() {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          <h1 className="shell__title">FormFlow</h1>
        </div>
      </header>

      <main className="shell__main">
        <section className="shell__viewer" aria-label="PDF form preview">
          <Suspense fallback={<p className="shell__loading">Loading PDF viewer…</p>}>
            <PdfFormViewer />
          </Suspense>
        </section>
      </main>

      <footer className="shell__footer">
        <span>Development: Vite · React · TypeScript · pdfjs-dist</span>
      </footer>
    </div>
  )
}

export default App
