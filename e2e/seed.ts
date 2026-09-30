/**
 * Deterministic demo data (Jun–Sep 2026) used by UI tests. Produced as a backup file and
 * restored through the real import flow.
 */
const TS = '2026-06-01T00:00:00.000Z';

const DEFAULT_CATEGORIES = [
  ['exp-food', 'expense', '食費', '🍙'],
  ['exp-transport', 'expense', '交通', '🚃'],
  ['exp-hobby', 'expense', '趣味', '🎮'],
  ['exp-clothes', 'expense', '衣服', '👕'],
  ['exp-subscription', 'expense', 'サブスク', '📱'],
  ['exp-education', 'expense', '教育', '📚'],
  ['exp-daily', 'expense', '日用品', '🧴'],
  ['exp-medical', 'expense', '医療', '💊'],
  ['exp-other', 'expense', 'その他', '📦'],
  ['inc-job', 'income', 'アルバイト', '💼'],
  ['inc-allowance', 'income', 'お小遣い', '🎁'],
  ['inc-other', 'income', 'その他収入', '✨'],
].map(([id, kind, name, emoji], i) => ({ id, kind, name, emoji, order: i % 9, archived: false }));

interface RuleSpec {
  id: string;
  type: 'income' | 'expense';
  name: string;
  amount: number;
  categoryId: string;
  day: number;
}

const RULES: RuleSpec[] = [
  { id: 'rule-job', type: 'income', name: 'アルバイト', amount: 62_000, categoryId: 'inc-job', day: 25 },
  { id: 'rule-allowance', type: 'income', name: 'お小遣い', amount: 5_000, categoryId: 'inc-allowance', day: 1 },
  { id: 'rule-phone', type: 'expense', name: 'スマホ代', amount: 2_980, categoryId: 'exp-subscription', day: 27 },
  { id: 'rule-claude', type: 'expense', name: 'Claude Pro', amount: 3_000, categoryId: 'exp-subscription', day: 12 },
];

const VARIABLE: [string, string, number, string][] = [
  ['2026-06-03', 'exp-food', 780, 'コンビニ'],
  ['2026-06-07', 'exp-transport', 420, '電車'],
  ['2026-06-11', 'exp-food', 1_150, 'ランチ'],
  ['2026-06-15', 'exp-hobby', 3_300, '本'],
  ['2026-06-20', 'exp-food', 640, 'カフェ'],
  ['2026-06-28', 'exp-daily', 980, '日用品'],
  ['2026-07-02', 'exp-food', 890, 'ランチ'],
  ['2026-07-06', 'exp-clothes', 5_990, 'Tシャツ'],
  ['2026-07-09', 'exp-transport', 1_200, 'バス'],
  ['2026-07-14', 'exp-food', 1_480, '友達とごはん'],
  ['2026-07-19', 'exp-hobby', 2_200, '映画'],
  ['2026-07-26', 'exp-food', 560, 'コンビニ'],
  ['2026-08-01', 'exp-food', 1_020, 'ランチ'],
  ['2026-08-05', 'exp-education', 2_640, '参考書'],
  ['2026-08-10', 'exp-transport', 680, '電車'],
  ['2026-08-16', 'exp-food', 2_300, '夏祭り'],
  ['2026-08-22', 'exp-medical', 1_500, '病院'],
  ['2026-08-29', 'exp-food', 720, 'カフェ'],
  ['2026-09-02', 'exp-food', 830, 'ランチ'],
  ['2026-09-06', 'exp-hobby', 4_400, 'ゲーム'],
  ['2026-09-11', 'exp-transport', 540, '電車'],
  ['2026-09-17', 'exp-food', 1_260, 'ラーメン'],
  ['2026-09-23', 'exp-daily', 760, 'シャンプー'],
  ['2026-09-29', 'exp-food', 580, 'コンビニ'],
  ['2026-09-30', 'exp-food', 650, 'おにぎりとお茶'],
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function demoBackup(): string {
  const transactions: Record<string, unknown>[] = [];
  for (const r of RULES) {
    for (const month of [6, 7, 8, 9]) {
      const date = `2026-${pad(month)}-${pad(r.day)}`;
      if (date > '2026-09-30') continue;
      transactions.push({
        id: `rec:${r.id}:${date}`,
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        date,
        memo: r.name,
        recurringRuleId: r.id,
        occurrenceDate: date,
        createdAt: TS,
        updatedAt: TS,
      });
    }
  }
  VARIABLE.forEach(([date, categoryId, amount, memo], i) => {
    transactions.push({
      id: `demo-${i}`,
      type: 'expense',
      amount,
      categoryId,
      date,
      memo,
      recurringRuleId: null,
      occurrenceDate: null,
      createdAt: `${date}T03:00:00.000Z`,
      updatedAt: `${date}T03:00:00.000Z`,
    });
  });
  return JSON.stringify({
    app: 'GoalBudget',
    schemaVersion: 1,
    exportedAt: '2026-09-30T00:00:00.000Z',
    goals: [
      {
        id: 'goal-demo',
        name: 'MacBook Pro',
        targetAmount: 450_000,
        initialSavings: 150_000,
        startDate: '2026-06-01',
        targetDate: '2027-04-01',
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    transactions,
    recurringRules: RULES.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      amount: r.amount,
      categoryId: r.categoryId,
      frequency: 'monthly',
      dayOfMonth: r.day,
      dayOfWeek: 0,
      month: 1,
      startDate: '2026-06-01',
      endDate: null,
      enabled: true,
      generatedThrough: '2026-09-30',
      createdAt: TS,
      updatedAt: TS,
    })),
    categories: DEFAULT_CATEGORIES,
    settings: { id: 'app', theme: 'system', lastBackupAt: '2026-09-20T12:00:00.000Z' },
  });
}
