import { Component, type ErrorInfo, type ReactNode } from 'react';
import BrandLogo from './BrandLogo';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last line of defence: if any screen crashes while rendering, the user sees this friendly
 * page instead of a blank white screen.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Later this is the place to send the error to a monitoring service.
    console.error('The screen crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950 px-6 text-center">
        <BrandLogo variant="mark" className="h-16 w-auto opacity-80" />
        <div>
          <h1 className="font-display text-3xl font-semibold text-gold-300">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            The page ran into an unexpected problem. Your data is safe. Reload the page to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
        >
          Reload page
        </button>
      </div>
    );
  }
}
