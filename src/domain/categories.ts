import type { Category, TxType } from './types';

/** Default categories use stable IDs so backups and recurring rules stay consistent. */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'exp-food', kind: 'expense', name: '食費', emoji: '🍙', order: 0, archived: false },
  { id: 'exp-transport', kind: 'expense', name: '交通', emoji: '🚃', order: 1, archived: false },
  { id: 'exp-hobby', kind: 'expense', name: '趣味', emoji: '🎮', order: 2, archived: false },
  { id: 'exp-clothes', kind: 'expense', name: '衣服', emoji: '👕', order: 3, archived: false },
  { id: 'exp-subscription', kind: 'expense', name: 'サブスク', emoji: '📱', order: 4, archived: false },
  { id: 'exp-education', kind: 'expense', name: '教育', emoji: '📚', order: 5, archived: false },
  { id: 'exp-daily', kind: 'expense', name: '日用品', emoji: '🧴', order: 6, archived: false },
  { id: 'exp-medical', kind: 'expense', name: '医療', emoji: '💊', order: 7, archived: false },
  { id: 'exp-other', kind: 'expense', name: 'その他', emoji: '📦', order: 8, archived: false },
  { id: 'inc-job', kind: 'income', name: 'アルバイト', emoji: '💼', order: 0, archived: false },
  { id: 'inc-allowance', kind: 'income', name: 'お小遣い', emoji: '🎁', order: 1, archived: false },
  { id: 'inc-other', kind: 'income', name: 'その他収入', emoji: '✨', order: 2, archived: false },
];

export const FALLBACK_CATEGORY_ID: Record<TxType, string> = {
  expense: 'exp-other',
  income: 'inc-other',
};

export const CATEGORY_EMOJI_CHOICES = [
  '🍙', '🍜', '☕️', '🍺', '🛒', '🚃', '🚕', '⛽️', '🎮', '🎧', '🎬', '📷',
  '👕', '👟', '💄', '💇', '📱', '💻', '📚', '✏️', '🧴', '🏠', '💡', '💊',
  '🏥', '🏋️', '✈️', '🎁', '💼', '💰', '✨', '📦',
] as const;

export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja'));
}

export function categoriesFor(categories: readonly Category[], kind: TxType, includeArchived = false): Category[] {
  return sortCategories(categories.filter((c) => c.kind === kind && (includeArchived || !c.archived)));
}

export function categoryMap(categories: readonly Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]));
}

export const UNKNOWN_CATEGORY: Category = {
  id: 'unknown',
  kind: 'expense',
  name: '未分類',
  emoji: '❔',
  order: 999,
  archived: true,
};
