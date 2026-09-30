import { describe, expect, it } from 'vitest';
import { makeGoal, makeRule, makeTx } from '../test/fixtures';
import { BackupValidationError, buildBackup, parseBackup, serializeBackup, summarizeBackup } from './backup';
import { DEFAULT_CATEGORIES } from './categories';
import { transactionsToCsv } from './csv';
import { DEFAULT_SETTINGS, type AppSnapshot } from './types';

function snapshot(): AppSnapshot {
  return {
    goal: makeGoal(),
    transactions: [
      makeTx({ id: 'a', amount: 1200, memo: 'ランチ', date: '2026-09-29' }),
      makeTx({ id: 'b', type: 'income', amount: 60000, categoryId: 'inc-job', recurringRuleId: 'r1', occurrenceDate: '2026-09-25', date: '2026-09-25' }),
    ],
    recurringRules: [makeRule({ id: 'r1' })],
    categories: [...DEFAULT_CATEGORIES],
    settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
  };
}

describe('backup export/import', () => {
  it('round-trips all data', () => {
    const data = buildBackup(snapshot(), '2026-09-30T00:00:00.000Z');
    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe('2026-09-30T00:00:00.000Z');
    const parsed = parseBackup(serializeBackup(data));
    expect(parsed).toEqual(data);
    expect(summarizeBackup(parsed)).toEqual({
      exportedAt: '2026-09-30T00:00:00.000Z',
      goalName: 'MacBook Pro',
      transactionCount: 2,
      ruleCount: 1,
      categoryCount: DEFAULT_CATEGORIES.length,
    });
  });

  it('includes every required top-level field', () => {
    const data = buildBackup(snapshot());
    expect(Object.keys(data).sort()).toEqual(
      ['app', 'categories', 'exportedAt', 'goals', 'recurringRules', 'schemaVersion', 'settings', 'transactions'].sort(),
    );
  });

  const reject = (text: string) => expect(() => parseBackup(text)).toThrow(BackupValidationError);
  const mutate = (fn: (d: Record<string, unknown>) => void) => {
    const d = JSON.parse(serializeBackup(buildBackup(snapshot()))) as Record<string, unknown>;
    fn(d);
    return JSON.stringify(d);
  };

  it('rejects invalid files', () => {
    reject('not json');
    reject('{}');
    reject(JSON.stringify({ app: 'Other', schemaVersion: 1 }));
    reject(mutate((d) => (d.schemaVersion = 99)));
    reject(mutate((d) => (d.schemaVersion = '1')));
    reject(mutate((d) => delete d.transactions));
    reject(mutate((d) => ((d.transactions as Record<string, unknown>[])[0]!.amount = 12.5)));
    reject(mutate((d) => ((d.transactions as Record<string, unknown>[])[0]!.amount = -1)));
    reject(mutate((d) => ((d.transactions as Record<string, unknown>[])[0]!.date = '2026/09/29')));
    reject(mutate((d) => ((d.transactions as Record<string, unknown>[])[0]!.type = 'transfer')));
    reject(mutate((d) => ((d.transactions as Record<string, unknown>[])[0]!.categoryId = 'missing')));
    reject(
      mutate((d) => {
        const txs = d.transactions as Record<string, unknown>[];
        txs[1]!.id = txs[0]!.id;
      }),
    );
    reject(mutate((d) => ((d.goals as Record<string, unknown>[])[0]!.targetAmount = 0)));
    reject(mutate((d) => ((d.recurringRules as Record<string, unknown>[])[0]!.dayOfMonth = 32)));
    reject(mutate((d) => (d.goals = [makeGoal({ id: 'x' }), makeGoal({ id: 'y' })])));
  });

  it('gives a Japanese error message for foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('GoalBudgetのバックアップファイルではありません');
  });
});

describe('csv export', () => {
  it('exports UTF-8 BOM CSV with Japanese headers, newest first, escaped', () => {
    const csv = transactionsToCsv(
      [
        makeTx({ id: 'a', amount: 1200, memo: 'ランチ, "大盛り"', date: '2026-09-28' }),
        makeTx({ id: 'b', type: 'income', amount: 60000, categoryId: 'inc-job', recurringRuleId: 'r', date: '2026-09-29' }),
        makeTx({ id: 'c', amount: 100, memo: '=HYPERLINK("x")', date: '2026-09-27' }),
      ],
      [...DEFAULT_CATEGORIES],
    );
    expect(csv.startsWith('\uFEFF日付,種類,カテゴリ,金額,メモ,自動記録\r\n')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[1]).toBe('2026-09-29,収入,アルバイト,60000,,定期');
    expect(lines[2]).toBe('2026-09-28,支出,食費,1200,"ランチ, ""大盛り""",');
    expect(lines[3]).toBe(`2026-09-27,支出,食費,100,"'=HYPERLINK(""x"")",`);
  });
});
