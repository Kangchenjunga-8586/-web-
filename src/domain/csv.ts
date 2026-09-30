import { UNKNOWN_CATEGORY } from './categories';
import type { Category, Transaction } from './types';

const HEADER = ['日付', '種類', 'カテゴリ', '金額', 'メモ', '自動記録'] as const;

function escapeCell(value: string): string {
  // Neutralise spreadsheet formula injection, then quote when needed.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Transactions as CSV (newest first). UTF-8 with BOM + CRLF so Numbers, Excel and
 * Google Sheets all detect Japanese text correctly. Amounts are plain integers.
 */
export function transactionsToCsv(transactions: readonly Transaction[], categories: readonly Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((tx) =>
      [
        tx.date,
        tx.type === 'income' ? '収入' : '支出',
        (byId.get(tx.categoryId) ?? UNKNOWN_CATEGORY).name,
        String(tx.amount),
        tx.memo,
        tx.recurringRuleId ? '定期' : '',
      ]
        .map(escapeCell)
        .join(','),
    );
  return `﻿${[HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}

export function csvFileName(today: string): string {
  return `goalbudget-transactions-${today}.csv`;
}
