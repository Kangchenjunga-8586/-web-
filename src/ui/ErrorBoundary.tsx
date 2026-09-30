import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last-resort screen. Data lives in IndexedDB, so reloading never loses anything. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page-x mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center text-center">
        <div className="text-[44px]" aria-hidden="true">
          🙇
        </div>
        <h1 className="mt-3 text-[22px] font-bold">問題が発生しました</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          保存済みのデータは端末内に残っています。再読み込みしてください。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mx-auto mt-6 min-h-[50px] rounded-2xl bg-accent px-8 text-[17px] font-semibold text-on-accent"
        >
          再読み込み
        </button>
      </main>
    );
  }
}
