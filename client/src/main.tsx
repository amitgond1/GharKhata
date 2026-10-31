import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles.css';
import './refinements.css';
import './mobile.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20000 }, mutations: { retry: false } },
});
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="startup">
        <h1>Let’s try that again.</h1>
        <p>The screen couldn’t load. Your saved project records are safe.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload GharKhata
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
