import { useEffect, useState } from 'react';
import { backupFileName, buildBackup, serializeBackup } from '../../domain/backup';
import { csvFileName, transactionsToCsv } from '../../domain/csv';
import { formatDateSlash, todayInTokyo } from '../../domain/dates';
import { formatYen } from '../../domain/money';
import type { ThemePreference } from '../../domain/types';
import { resetGoal, updateSettings, wipeAllData } from '../../storage/repository';
import { useApp } from '../AppContext';
import { ImportBackup } from '../components/ImportBackup';
import { DownloadIcon, ShareIcon, TableIcon, UploadIcon } from '../components/Icons';
import { Row, ScreenHeader, Section } from '../components/layout';
import { Segmented } from '../components/Segmented';
import { isStandalone } from '../hooks/useTheme';
import { shareOrDownload } from '../lib/share';

const THEME_OPTIONS = [
  { value: 'system', label: '自動' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
] as const;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(d);
  return `${formatDateSlash(todayInTokyo(d))} ${time}`;
}

export function SettingsScreen() {
  const { snapshot, goal, today, navigate, openSheet, toast, confirm } = useApp();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const standalone = isStandalone();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const incomeCount = snapshot.recurringRules.filter((r) => r.type === 'income').length;
  const expenseCount = snapshot.recurringRules.filter((r) => r.type === 'expense').length;
  const activeCategories = snapshot.categories.filter((c) => !c.archived).length;

  const exportBackup = async () => {
    // Built synchronously from the in-memory snapshot so the iOS share sheet still
    // counts as a direct response to the tap.
    const json = serializeBackup(buildBackup(snapshot));
    const result = await shareOrDownload(backupFileName(today), 'application/json', json);
    if (result === 'cancelled') return;
    await updateSettings({ lastBackupAt: new Date().toISOString() });
    toast({ message: result === 'shared' ? 'バックアップを書き出しました' : 'バックアップファイルを保存しました' });
  };

  const exportCsv = async () => {
    const csv = transactionsToCsv(snapshot.transactions, snapshot.categories);
    const result = await shareOrDownload(csvFileName(today), 'text/csv', csv);
    if (result !== 'cancelled') toast({ message: `CSVを書き出しました（${snapshot.transactions.length}件）` });
  };

  const onResetGoal = async () => {
    const ok = await confirm({
      title: '目標をリセットしますか？',
      message: `「${goal.name}」の目標設定を削除して、最初の設定画面に戻ります。\n取引・定期ルール・カテゴリは残ります。`,
      confirmLabel: 'リセット',
      destructive: true,
    });
    if (ok) await resetGoal();
  };

  const onWipe = async () => {
    const ok = await confirm({
      title: 'すべてのデータを削除しますか？',
      message: `目標・取引${snapshot.transactions.length}件・定期ルール・カテゴリをこのiPhoneから完全に削除します。元に戻せません。\n必要なら先にバックアップを書き出してください。`,
      confirmLabel: '完全に削除',
      destructive: true,
      requireText: '削除',
    });
    if (ok) {
      await wipeAllData();
      window.location.hash = '#/';
    }
  };

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader title="設定" />
      <div className="page-x">
        <Section title="目標">
          <Row
            icon="🎯"
            title={goal.name}
            detail={`${formatYen(goal.targetAmount)} ・ ${formatDateSlash(goal.targetDate)}まで`}
            onClick={() => openSheet({ kind: 'goal' })}
            testId="settings-goal"
          />
        </Section>

        <Section title="定期的なお金" footer="登録すると、支払日・入金日に自動で記録されます。同じ日の記録が二重に作られることはありません。">
          <Row icon="💼" title="定期収入" value={`${incomeCount}件`} onClick={() => navigate('settings/income')} testId="settings-income" />
          <Row icon="📱" title="固定支出" value={`${expenseCount}件`} onClick={() => navigate('settings/expenses')} testId="settings-expenses" />
          <Row icon="🏷️" title="カテゴリ" value={`${activeCategories}件`} onClick={() => navigate('settings/categories')} testId="settings-categories" />
        </Section>

        <Section title="表示">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[16px]">テーマ</span>
            <Segmented
              label="テーマ"
              size="sm"
              options={THEME_OPTIONS}
              value={snapshot.settings.theme}
              onChange={(theme: ThemePreference) => void updateSettings({ theme })}
            />
          </div>
        </Section>

        <Section
          title="バックアップ"
          footer="データはこのiPhoneの中だけに保存されています。機種変更やデータ消失に備えて、ときどき「ファイル」アプリやiCloud Driveに書き出しておくと安心です。"
        >
          <Row
            icon={<DownloadIcon size={22} className="text-accent-ink" />}
            title="バックアップを書き出す"
            detail={snapshot.settings.lastBackupAt ? `最終：${formatTimestamp(snapshot.settings.lastBackupAt)}` : 'まだ書き出していません'}
            onClick={() => void exportBackup()}
            testId="export-backup"
          />
          <ImportBackup
            onDone={(message) => toast({ message })}
            onError={(message) => toast({ message, tone: 'error' })}
          >
            {(open) => (
              <Row
                icon={<UploadIcon size={22} className="text-accent-ink" />}
                title="バックアップから復元"
                detail="「ファイル」からJSONを選びます"
                onClick={open}
                testId="import-backup"
              />
            )}
          </ImportBackup>
          <Row
            icon={<TableIcon size={22} className="text-accent-ink" />}
            title="取引をCSVで書き出す"
            detail="Numbers・スプレッドシートで開けます"
            onClick={() => void exportCsv()}
            testId="export-csv"
          />
        </Section>

        {!standalone && (
          <Section title="ホーム画面に追加" footer="ホーム画面から開くと、アプリのように全画面で使えます。">
            <div className="flex items-start gap-3 px-4 py-3.5 text-[15px] leading-relaxed">
              <ShareIcon size={22} className="mt-0.5 shrink-0 text-accent-ink" />
              <p>
                Safari下部の<span className="font-semibold">共有ボタン</span>をタップし、
                <span className="font-semibold">「ホーム画面に追加」</span>を選んでください。
              </p>
            </div>
          </Section>
        )}

        <Section title="リセット">
          <Row title="目標をリセット" destructive onClick={() => void onResetGoal()} chevron={false} testId="reset-goal" />
          <Row title="すべてのデータを削除" destructive onClick={() => void onWipe()} chevron={false} testId="wipe-all" />
        </Section>

        <Section title="このアプリについて">
          <Row title="バージョン" value={__APP_VERSION__} />
          <Row title="データの保存先" value="このiPhone内のみ" />
          {persisted !== null && <Row title="ストレージ保護" value={persisted ? '有効' : 'ブラウザ任せ'} />}
        </Section>
        <p className="mt-4 mb-2 text-center text-[12px] text-ink-3">
          外部への送信・広告・トラッキングは一切ありません。
        </p>
      </div>
    </main>
  );
}
