import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { computeDashboard } from '../domain/calculations';
import { categoryMap } from '../domain/categories';
import type { AppSnapshot, Goal, ISODate, TxType } from '../domain/types';
import {
  generateRecurringTransactions,
  initializeDatabase,
  loadSnapshot,
  requestPersistentStorage,
} from '../storage/repository';
import { AppContext, type AppContextValue, type SheetState } from './AppContext';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog, type ConfirmOptions } from './components/ConfirmDialog';
import { Toast, type ToastData } from './components/Toast';
import { useKeyboardInset } from './hooks/useKeyboardInset';
import { useRoute } from './hooks/useRoute';
import { useTheme } from './hooks/useTheme';
import { useToday } from './hooks/useToday';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlanScreen } from './screens/PlanScreen';
import { RecurringScreen } from './screens/RecurringScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { CategorySheet } from './sheets/CategorySheet';
import { GoalSheet } from './sheets/GoalSheet';
import { RuleSheet } from './sheets/RuleSheet';
import { TX_AMOUNT_INPUT_ID, TransactionSheet } from './sheets/TransactionSheet';

export function App() {
  useKeyboardInset();
  const today = useToday();
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState(false);

  useEffect(() => {
    initializeDatabase().then(
      () => setReady(true),
      (error) => {
        console.error(error);
        setFatal(true);
      },
    );
    void requestPersistentStorage();
  }, []);

  const snapshot = useLiveQuery(() => (ready ? loadSnapshot() : undefined), [ready]);
  useTheme(snapshot?.settings.theme);

  // Create due recurring transactions on launch and whenever the date changes.
  useEffect(() => {
    if (!ready) return;
    generateRecurringTransactions(today).catch((error) => console.error(error));
  }, [ready, today]);

  if (fatal) return <StorageUnavailable />;
  if (!snapshot) return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  if (!snapshot.goal) return <SetupScreen today={today} />;
  return <Shell snapshot={snapshot} goal={snapshot.goal} today={today} />;
}

function StorageUnavailable() {
  return (
    <main className="page-x mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center text-center">
      <div className="text-[44px]" aria-hidden="true">
        🔒
      </div>
      <h1 className="mt-3 text-[22px] font-bold">データを保存できません</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        この環境ではブラウザの保存領域（IndexedDB）が使えません。Safariのプライベートブラウズをオフにするか、ホーム画面に追加したアプリから開いてください。
      </p>
    </main>
  );
}

interface ShellProps {
  snapshot: AppSnapshot;
  goal: Goal;
  today: ISODate;
}

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

function Shell({ snapshot, goal, today }: ShellProps) {
  const { route, navigate, back } = useRoute();
  // `key` remounts the sheet on every open so form state never leaks between uses.
  const [sheet, setSheet] = useState<{ state: SheetState; key: number } | null>(null);
  const sheetKey = useRef(0);
  const [toastData, setToastData] = useState<ToastData | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const dashboard = useMemo(
    () => computeDashboard(goal, snapshot.transactions, snapshot.recurringRules, today),
    [goal, snapshot.transactions, snapshot.recurringRules, today],
  );
  const categoriesById = useMemo(() => categoryMap(snapshot.categories), [snapshot.categories]);

  const openSheet = useCallback((next: SheetState) => {
    sheetKey.current += 1;
    setSheet({ state: next, key: sheetKey.current });
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const openAdd = useCallback((type: TxType) => {
    // Render the sheet synchronously and focus inside the same tap so iOS shows the
    // numeric keypad immediately.
    sheetKey.current += 1;
    const key = sheetKey.current;
    flushSync(() => setSheet({ state: { kind: 'tx-add', type }, key }));
    document.getElementById(TX_AMOUNT_INPUT_ID)?.focus();
  }, []);

  const toast = useCallback((t: Omit<ToastData, 'id'>) => setToastData({ ...t, id: Date.now() }), []);
  const dismissToast = useCallback(() => setToastData(null), []);
  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      snapshot,
      goal,
      today,
      dashboard,
      categoriesById,
      route,
      navigate,
      back,
      openAdd,
      openSheet,
      closeSheet,
      toast,
      confirm,
    }),
    [snapshot, goal, today, dashboard, categoriesById, route, navigate, back, openAdd, openSheet, closeSheet, toast, confirm],
  );

  let screen;
  switch (route) {
    case 'history':
      screen = <HistoryScreen />;
      break;
    case 'plan':
      screen = <PlanScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'settings/income':
      screen = <RecurringScreen key="income" type="income" />;
      break;
    case 'settings/expenses':
      screen = <RecurringScreen key="expense" type="expense" />;
      break;
    case 'settings/categories':
      screen = <CategoriesScreen />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <AppContext.Provider value={value}>
      <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+96px)]">{screen}</div>
      <BottomNav route={route} onNavigate={navigate} onAdd={() => openAdd('expense')} />
      {sheet && <SheetHost key={sheet.key} sheet={sheet.state} />}
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onResult={(ok) => {
            confirmState.resolve(ok);
            setConfirmState(null);
          }}
        />
      )}
      <Toast toast={toastData} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
}

function SheetHost({ sheet }: { sheet: SheetState }) {
  switch (sheet.kind) {
    case 'tx-add':
      return <TransactionSheet initialType={sheet.type} editing={null} />;
    case 'tx-edit':
      return <TransactionSheet initialType={sheet.tx.type} editing={sheet.tx} />;
    case 'goal':
      return <GoalSheet />;
    case 'rule':
      return <RuleSheet type={sheet.type} rule={sheet.rule} />;
    case 'category':
      return <CategorySheet kind={sheet.categoryKind} category={sheet.category} />;
  }
}
