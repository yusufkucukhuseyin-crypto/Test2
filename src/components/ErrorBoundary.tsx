import { Component, type ReactNode } from 'react'

/** Bir ekranda hata olursa tüm uygulamanın beyaza düşmesini engeller */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 text-center">
        <div className="font-display text-lg">Bir şeyler ters gitti</div>
        <p className="mt-2 text-sm text-muted">
          Bu ekran açılırken bir hata oluştu. Verileriniz güvende; sayfayı yenileyerek tekrar deneyebilirsiniz.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-50 p-2 text-left text-xs text-muted">{this.state.error.message}</pre>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-4 h-10 rounded-xl bg-accent px-4 font-medium text-white"
        >
          Sayfayı yenile
        </button>
      </div>
    )
  }
}
