import { useId, useState } from 'react';
import type { ISODate } from '../../domain/types';
import { generateRecurringTransactions, saveGoal } from '../../storage/repository';
import { errorMessage } from '../AppContext';
import { Button } from '../components/Button';
import { ImportBackup } from '../components/ImportBackup';
import { GoalForm } from '../sheets/GoalForm';

interface Props {
  today: ISODate;
}

/** First launch: one short form, then straight to the dashboard. */
export function SetupScreen({ today }: Props) {
  const formId = useId();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <main className="page-x mx-auto max-w-[560px] pt-[max(env(safe-area-inset-top),16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="pt-6 pb-6">
        <div
          className="grid size-14 place-items-center rounded-[18px] bg-accent text-[28px] text-white shadow-[0_6px_18px_rgb(37_106_191/0.35)]"
          aria-hidden="true"
        >
          🎯
        </div>
        <h1 className="mt-4 text-[30px] leading-tight font-bold tracking-[-0.01em]">目標を決めましょう</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
          買いたい物と金額を入れるだけ。毎月・毎週いくら貯めればいいか、今のペースで間に合うかを自動で計算します。
        </p>
      </div>

      <div className="card p-5">
        <GoalForm
          formId={formId}
          today={today}
          onSubmit={async (input) => {
            setSaving(true);
            try {
              await saveGoal(input);
              await generateRecurringTransactions(today);
            } catch (error) {
              setSaving(false);
              setMessage({ text: errorMessage(error), error: true });
            }
          }}
        />
      </div>

      <Button type="submit" form={formId} size="lg" block className="mt-5" disabled={saving} data-testid="setup-submit">
        はじめる
      </Button>

      {message && (
        <p role="alert" className={`mt-3 text-center text-[14px] ${message.error ? 'text-danger' : 'text-good'}`}>
          {message.text}
        </p>
      )}

      <p className="mt-6 text-center text-[13px] leading-relaxed text-ink-3">
        データはこのiPhoneの中だけに保存され、外部には送信されません。
      </p>
      <ImportBackup
        onDone={(text) => setMessage({ text })}
        onError={(text) => setMessage({ text, error: true })}
      >
        {(open) => (
          <div className="mt-2 flex justify-center">
            <Button variant="ghost" onClick={open}>
              バックアップから復元する
            </Button>
          </div>
        )}
      </ImportBackup>
    </main>
  );
}
