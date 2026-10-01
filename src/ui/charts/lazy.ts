import { lazy } from 'react';

/**
 * Shared lazy chart components. Using one lazy() per chart means that once Home has loaded
 * the savings chart, the グラフ tab renders it immediately without a loading placeholder.
 */
export const SavingsChart = lazy(() => import('./SavingsChart'));
export const CashFlowChart = lazy(() => import('./CashFlowChart'));
