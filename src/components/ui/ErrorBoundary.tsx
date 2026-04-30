import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-2xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10">
              <AlertOctagon className="h-8 w-8 text-rose-400" />
            </div>
          </div>

          <h1 className="mb-2 text-xl font-bold text-white">Something went wrong</h1>
          <p className="mb-6 max-w-md text-sm text-slate-400">
            An unexpected error occurred in NetMonitor Pro. The error has been logged to the console.
          </p>

          {this.state.error && (
            <pre className="mb-6 max-w-lg overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left text-[11px] text-rose-300">
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.08] hover:border-white/20"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
