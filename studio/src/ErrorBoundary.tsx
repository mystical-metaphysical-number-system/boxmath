import { Component, type ErrorInfo, type ReactNode } from 'react'

// A last-resort backstop. React unmounts the whole tree on an uncaught
// render/commit error by default — for this app that meant one bad edit
// in the pure-mode editor could tear down the Canvas along with it,
// killing the WebGL context and leaving a blank white page. This turns
// that into a recoverable message instead of a dead tab.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('boxmath studio crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace' }}>
          <h1>Something broke</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
