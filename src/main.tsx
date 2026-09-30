import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { PwaUpdatePrompt } from './ui/PwaUpdatePrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <PwaUpdatePrompt />
  </StrictMode>,
);
