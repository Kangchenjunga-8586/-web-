import type { ReactNode } from 'react';
import type { PaceStatus } from '../../domain/calculations';
import { AlertIcon, CheckIcon, TrendDownIcon, TrophyIcon } from './Icons';

const STYLE: Record<PaceStatus, { short: string; cls: string; icon: ReactNode }> = {
  achieved: { short: '達成', cls: 'bg-good-soft text-good', icon: <TrophyIcon size={15} strokeWidth={2.4} /> },
  'on-track': { short: '順調', cls: 'bg-good-soft text-good', icon: <CheckIcon size={15} strokeWidth={2.6} /> },
  'slightly-behind': { short: '少し遅れ', cls: 'bg-warn-soft text-warn', icon: <AlertIcon size={15} strokeWidth={2.4} /> },
  behind: { short: '遅れ気味', cls: 'bg-danger-soft text-danger', icon: <TrendDownIcon size={15} strokeWidth={2.4} /> },
  overdue: { short: '期限超過', cls: 'bg-danger-soft text-danger', icon: <AlertIcon size={15} strokeWidth={2.4} /> },
};

/** Status pill: icon + label, so meaning never relies on color alone. */
export function PaceBadge({ status }: { status: PaceStatus }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${s.cls}`}>
      {s.icon}
      {s.short}
    </span>
  );
}

export function PaceIcon({ status, size = 22 }: { status: PaceStatus; size?: number }) {
  const s = STYLE[status];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${s.cls}`} style={{ width: size + 14, height: size + 14 }} aria-hidden="true">
      {status === 'achieved' ? (
        <TrophyIcon size={size} />
      ) : status === 'on-track' ? (
        <CheckIcon size={size} strokeWidth={2.4} />
      ) : status === 'behind' ? (
        <TrendDownIcon size={size} />
      ) : (
        <AlertIcon size={size} />
      )}
    </span>
  );
}
