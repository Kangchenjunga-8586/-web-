import type { ReactNode } from 'react';
import type { Route, TabRoute } from '../hooks/useRoute';
import { parentOf } from '../hooks/useRoute';
import { GearIcon, HomeIcon, ListIcon, PlusIcon, TargetIcon } from './Icons';

interface Props {
  route: Route;
  onNavigate: (route: TabRoute) => void;
  onAdd: () => void;
}

const TABS: { route: TabRoute; label: string; icon: ReactNode }[] = [
  { route: 'home', label: 'ホーム', icon: <HomeIcon /> },
  { route: 'history', label: '履歴', icon: <ListIcon /> },
  { route: 'plan', label: 'プラン', icon: <TargetIcon /> },
  { route: 'settings', label: '設定', icon: <GearIcon /> },
];

/**
 * Bottom tab bar sitting above the home indicator. The centre button starts an expense
 * entry from any screen with one tap.
 */
export function BottomNav({ route, onNavigate, onAdd }: Props) {
  const active = parentOf(route);
  const tab = (t: (typeof TABS)[number]) => {
    const selected = t.route === active;
    return (
      <button
        key={t.route}
        type="button"
        onClick={() => onNavigate(t.route)}
        aria-current={selected ? 'page' : undefined}
        className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 ${selected ? 'text-accent-ink' : 'text-ink-3'}`}
      >
        {t.icon}
        <span className="text-[11px] leading-none font-medium">{t.label}</span>
      </button>
    );
  };
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/85 backdrop-blur-xl backdrop-saturate-150"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="mx-auto grid h-[58px] max-w-[560px] grid-cols-5 items-center px-2">
        {tab(TABS[0]!)}
        {tab(TABS[1]!)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="支出を記録"
            data-testid="fab-add"
            className="pressable grid size-[52px] place-items-center rounded-full bg-accent text-on-accent shadow-[0_4px_14px_rgb(37_106_191/0.35)]"
          >
            <PlusIcon size={28} strokeWidth={2.4} />
          </button>
        </div>
        {tab(TABS[2]!)}
        {tab(TABS[3]!)}
      </div>
    </nav>
  );
}
