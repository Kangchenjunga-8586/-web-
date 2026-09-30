import { createContext, useContext } from 'react';
import type { Dashboard } from '../domain/calculations';
import type { AppSnapshot, Category, Goal, ISODate, RecurringRule, Transaction, TxType } from '../domain/types';
import type { ConfirmOptions } from './components/ConfirmDialog';
import type { ToastData } from './components/Toast';
import type { Route } from './hooks/useRoute';

export type SheetState =
  | { kind: 'tx-add'; type: TxType }
  | { kind: 'tx-edit'; tx: Transaction }
  | { kind: 'goal' }
  | { kind: 'rule'; type: TxType; rule: RecurringRule | null }
  | { kind: 'category'; categoryKind: TxType; category: Category | null };

export interface AppContextValue {
  snapshot: AppSnapshot;
  goal: Goal;
  today: ISODate;
  dashboard: Dashboard;
  categoriesById: Map<string, Category>;
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  /** Opens the add sheet and focuses the amount field in the same tap (iOS keyboard). */
  openAdd: (type: TxType) => void;
  openSheet: (sheet: SheetState) => void;
  closeSheet: () => void;
  toast: (toast: Omit<ToastData, 'id'>) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppContext');
  return ctx;
}

/** Japanese message for any thrown error. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(error.message)) return error.message;
  return '保存できませんでした。もう一度お試しください。';
}
