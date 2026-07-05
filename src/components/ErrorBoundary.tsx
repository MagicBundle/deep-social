import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Last-resort guard: a thrown error anywhere in the tree renders a recovery
// card instead of a blank white screen. Reloading clears transient state.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] uncaught error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="logo-mark">◍</div>
          <h2>Something broke</h2>
          <p>Deep Social hit an unexpected error. This is a beta — thanks for bearing with it.</p>
          <code>{this.state.error.message}</code>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
