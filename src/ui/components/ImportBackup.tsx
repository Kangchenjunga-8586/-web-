import { useCallback, useId, useState, type ReactNode } from 'react';
import { BackupValidationError, parseBackup, summarizeBackup } from '../../domain/backup';
import { todayInTokyo } from '../../domain/dates';
import type { BackupData } from '../../domain/types';
import { generateRecurringTransactions, importBackup } from '../../storage/repository';
import { readFileAsText } from '../lib/share';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  onDone: (message: string) => void;
  onError: (message: string) => void;
  children: (open: () => void) => ReactNode;
}

function formatExportedAt(iso: string): string {
  const date = todayInTokyo(new Date(iso)).replaceAll('-', '/');
  const time = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return `${date} ${time}`;
}

/**
 * Restore from a JSON backup chosen in the iOS Files picker. The file is fully validated
 * first; the current data is only replaced after explicit confirmation, atomically.
 */
export function ImportBackup({ onDone, onError, children }: Props) {
  const inputId = useId();
  const [pending, setPending] = useState<BackupData | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = parseBackup(await readFileAsText(file));
      setPending(data);
    } catch (error) {
      onError(error instanceof BackupValidationError ? error.message : 'ファイルを読み込めませんでした。');
    } finally {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  const summary = pending ? summarizeBackup(pending) : null;
  const open = useCallback(() => document.getElementById(inputId)?.click(), [inputId]);

  return (
    <>
      {children(open)}
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="backup-file-input"
        aria-label="バックアップファイルを選ぶ"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {pending && summary && (
        <ConfirmDialog
          title="バックアップから復元しますか？"
          message={[
            `書き出し日時：${formatExportedAt(summary.exportedAt)}`,
            `目標：${summary.goalName ?? 'なし'}`,
            `取引：${summary.transactionCount}件 / 定期：${summary.ruleCount}件`,
            '',
            '現在このiPhoneに保存されているデータは、すべてこの内容に置き換わります。',
          ].join('\n')}
          confirmLabel="復元する"
          destructive
          onResult={async (ok) => {
            const data = pending;
            setPending(null);
            if (!ok) return;
            try {
              await importBackup(data);
              await generateRecurringTransactions(todayInTokyo());
              onDone(`バックアップを復元しました（取引${data.transactions.length}件）`);
            } catch {
              onError('復元に失敗しました。データは変更されていません。');
            }
          }}
        />
      )}
    </>
  );
}
